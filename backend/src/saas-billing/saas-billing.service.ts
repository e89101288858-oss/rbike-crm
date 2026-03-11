import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'

const PLAN_PRICES_RUB: Record<string, number> = {
  STARTER: 1,
  PRO: 4990,
  ENTERPRISE: 14990,
}

const PLAN_FEATURES: Record<string, { maxBikes: number | null; maxActiveRentals: number | null; support: string }> = {
  STARTER: { maxBikes: 15, maxActiveRentals: null, support: 'Базовая' },
  PRO: { maxBikes: 50, maxActiveRentals: null, support: 'Приоритетная' },
  ENTERPRISE: { maxBikes: null, maxActiveRentals: null, support: 'Выделенная' },
}

@Injectable()
export class SaasBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getYooAuthHeader() {
    const shopId = this.config.get<string>('YOOKASSA_SHOP_ID')
    const secretKey = this.config.get<string>('YOOKASSA_SECRET_KEY')
    if (!shopId || !secretKey) throw new BadRequestException('YooKassa не настроена')
    return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`
  }

  private async fetchPaymentFromYoo(paymentId: string) {
    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      headers: { Authorization: this.getYooAuthHeader() },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new BadRequestException(`YooKassa payment lookup failed: HTTP ${response.status}${body ? ` | ${body}` : ''}`)
    }

    return response.json()
  }

  async createCheckout(tenantId: string, userId: string, plan?: 'STARTER' | 'PRO' | 'ENTERPRISE', durationMonths = 1) {
    const [tenant, user] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, mode: true, saasPlan: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, phone: true } }),
    ])
    if (!tenant) throw new BadRequestException('Tenant не найден')
    if (tenant.mode !== 'SAAS') throw new BadRequestException('Оплата доступна только для SaaS tenant')

    const targetPlan = plan || (tenant.saasPlan || 'STARTER')
    const baseAmountRub = PLAN_PRICES_RUB[targetPlan]
    if (!baseAmountRub) throw new BadRequestException('Неизвестный план')

    if (![1,3,6,12].includes(durationMonths)) {
      throw new BadRequestException('Допустимые сроки оплаты: 1, 3, 6, 12 месяцев')
    }

    const amountRub = baseAmountRub * durationMonths

    const returnUrlBase = this.config.get<string>('YOOKASSA_RETURN_URL') || 'https://app.rbcrm.ru/settings'
    const returnUrl = `${returnUrlBase}${returnUrlBase.includes('?') ? '&' : '?'}billing_return=1`
    const vatCode = Number(this.config.get<string>('YOOKASSA_VAT_CODE') || '1')

    if (!user?.email && !user?.phone) {
      throw new BadRequestException('Для оплаты нужен email или телефон пользователя')
    }

    const invoice = await this.prisma.saaSInvoice.create({
      data: {
        tenantId,
        createdById: userId,
        plan: targetPlan as any,
        amountRub,
        durationMonths,
        currency: 'RUB',
        status: 'PENDING',
      },
    })

    const payload = {
      amount: { value: amountRub.toFixed(2), currency: 'RUB' },
      capture: true,
      description: `Оплата подписки на rbCRM тариф "${targetPlan}" на ${durationMonths} мес. ID платежа: ${invoice.id}`,
      confirmation: {
        type: 'redirect',
        return_url: returnUrl,
      },
      receipt: {
        customer: {
          ...(user?.email ? { email: user.email } : {}),
          ...(user?.phone ? { phone: user.phone } : {}),
        },
        items: [
          {
            description: `Подписка rbCRM SaaS (${targetPlan}, ${durationMonths} мес.), ID: ${invoice.id}`,
            quantity: '1.00',
            amount: { value: amountRub.toFixed(2), currency: 'RUB' },
            vat_code: vatCode,
            payment_mode: 'full_payment',
            payment_subject: 'service',
          },
        ],
      },
      metadata: {
        invoiceId: invoice.id,
        tenantId,
        plan: targetPlan,
        durationMonths,
      },
    }

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: this.getYooAuthHeader(),
        'Content-Type': 'application/json',
        'Idempotence-Key': invoice.id,
      },
      body: JSON.stringify(payload),
    })

    const body = await response.json()
    if (!response.ok) {
      await this.prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: { status: 'FAILED', providerResponse: body as any },
      })
      const details = [body?.description, body?.parameter].filter(Boolean).join(' | ')
      throw new BadRequestException(details || 'Ошибка создания платежа YooKassa')
    }

    await this.prisma.saaSInvoice.update({
      where: { id: invoice.id },
      data: {
        providerPaymentId: body.id,
        providerResponse: body as any,
        checkoutUrl: body?.confirmation?.confirmation_url || null,
      },
    })

    return {
      invoiceId: invoice.id,
      checkoutUrl: body?.confirmation?.confirmation_url || null,
      status: body?.status || 'pending',
      amountRub,
      plan: targetPlan,
      durationMonths,
    }
  }

  private async markInvoicePaid(invoice: { id: string; tenantId: string; plan: 'STARTER' | 'PRO' | 'ENTERPRISE'; durationMonths: number }, payload: any) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.saaSInvoice.findUnique({ where: { id: invoice.id }, select: { status: true } })
      if (!current || current.status === 'PAID') return

      await tx.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          providerResponse: payload,
        },
      })

      const currentTenant = await tx.tenant.findUnique({
        where: { id: invoice.tenantId },
        select: { saasPaidUntil: true },
      })
      const now = new Date()
      const base = currentTenant?.saasPaidUntil && currentTenant.saasPaidUntil > now ? currentTenant.saasPaidUntil : now
      const paidUntil = new Date(base)
      paidUntil.setUTCMonth(paidUntil.getUTCMonth() + Number(invoice.durationMonths || 1))

      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          saasSubscriptionStatus: 'ACTIVE',
          saasPlan: invoice.plan,
          saasPaidUntil: paidUntil,
        },
      })
    })
  }

  private async syncPendingInvoices(tenantId: string) {
    const pending = await this.prisma.saaSInvoice.findMany({
      where: { tenantId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, tenantId: true, plan: true, durationMonths: true, providerPaymentId: true, createdAt: true },
    })

    for (const inv of pending) {
      try {
        if (!inv.providerPaymentId) {
          if (Date.now() - new Date(inv.createdAt).getTime() > 5 * 60 * 1000) {
            await this.prisma.saaSInvoice.update({
              where: { id: inv.id },
              data: {
                status: 'FAILED',
                providerResponse: { reason: 'providerPaymentId missing for pending invoice' },
              },
            })
          }
          continue
        }

        let body: any = {}
        try {
          body = await this.fetchPaymentFromYoo(inv.providerPaymentId)
        } catch (e) {
          await this.prisma.saaSInvoice.update({
            where: { id: inv.id },
            data: { providerResponse: { syncError: true, message: e instanceof Error ? e.message : 'lookup failed' } as any },
          })
          continue
        }

        const status = String(body?.status || '').toLowerCase()

        if (status === 'succeeded') {
          await this.markInvoicePaid({ id: inv.id, tenantId: inv.tenantId, plan: inv.plan as any, durationMonths: inv.durationMonths }, body)
        } else if (status === 'canceled') {
          await this.prisma.saaSInvoice.update({
            where: { id: inv.id },
            data: { status: 'CANCELED', providerResponse: body },
          })
        } else {
          const ageMs = Date.now() - new Date(inv.createdAt).getTime()
          if (status === 'pending' && ageMs > 30 * 60 * 1000) {
            await this.prisma.saaSInvoice.update({
              where: { id: inv.id },
              data: {
                status: 'FAILED',
                providerResponse: { ...body, autoClosed: true, reason: 'pending_timeout_30m' } as any,
              },
            })
          } else {
            await this.prisma.saaSInvoice.update({
              where: { id: inv.id },
              data: { providerResponse: body },
            })
          }
        }
      } catch {
        // best effort sync
      }
    }
  }

  async getMyBilling(tenantId: string) {
    await this.syncPendingInvoices(tenantId)

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, mode: true, saasPlan: true, saasSubscriptionStatus: true, saasTrialEndsAt: true, saasPaidUntil: true },
    })
    if (!tenant) throw new BadRequestException('Tenant не найден')

    const invoices = await this.prisma.saaSInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        plan: true,
        durationMonths: true,
        amountRub: true,
        currency: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    })

    return {
      tenant,
      invoices,
      plans: {
        STARTER: { priceRub: PLAN_PRICES_RUB.STARTER, ...PLAN_FEATURES.STARTER },
        PRO: { priceRub: PLAN_PRICES_RUB.PRO, ...PLAN_FEATURES.PRO },
        ENTERPRISE: { priceRub: PLAN_PRICES_RUB.ENTERPRISE, ...PLAN_FEATURES.ENTERPRISE },
      },
      prices: PLAN_PRICES_RUB,
    }
  }

  async handleWebhook(payload: any) {
    const event = payload?.event
    const obj = payload?.object
    if (!event || !obj?.id) return { ok: true }

    const payment = await this.fetchPaymentFromYoo(String(obj.id))
    const invoiceId = payment?.metadata?.invoiceId || obj?.metadata?.invoiceId

    const byPayment = await this.prisma.saaSInvoice.findFirst({ where: { providerPaymentId: String(obj.id) } })
    const invoice = byPayment || (invoiceId ? await this.prisma.saaSInvoice.findUnique({ where: { id: String(invoiceId) } }) : null)
    if (!invoice) return { ok: true }

    const amountValue = Number(payment?.amount?.value || 0)
    if (amountValue > 0 && Math.round(amountValue) !== Math.round(invoice.amountRub)) {
      throw new BadRequestException('Webhook amount does not match invoice amount')
    }

    const status = String(payment?.status || '').toLowerCase()
    if (status === 'succeeded') {
      await this.markInvoicePaid({ id: invoice.id, tenantId: invoice.tenantId, plan: invoice.plan as any, durationMonths: invoice.durationMonths || 1 }, payment)
    } else if (status === 'canceled') {
      await this.prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELED',
          providerResponse: payment,
        },
      })
    } else {
      await this.prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'PENDING',
          providerResponse: payment,
        },
      })
    }

    return { ok: true }
  }
}
