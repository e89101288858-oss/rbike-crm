import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'

const PLAN_PRICES_RUB: Record<string, number> = {
  STARTER: 1990,
  PRO: 4990,
  ENTERPRISE: 14990,
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

  async createCheckout(tenantId: string, userId: string, plan?: 'STARTER' | 'PRO' | 'ENTERPRISE') {
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
    const amountRub = PLAN_PRICES_RUB[targetPlan]
    if (!amountRub) throw new BadRequestException('Неизвестный план')

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
        currency: 'RUB',
        status: 'PENDING',
      },
    })

    const payload = {
      amount: { value: amountRub.toFixed(2), currency: 'RUB' },
      capture: true,
      description: `Оплата подписки на rbCRM тариф "${targetPlan}" на 30 дней.`,
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
            description: `Подписка rbCRM SaaS (${targetPlan})`,
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
    }
  }

  async getMyBilling(tenantId: string) {
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
      prices: PLAN_PRICES_RUB,
    }
  }

  async handleWebhook(payload: any) {
    const event = payload?.event
    const obj = payload?.object
    if (!event || !obj?.id) return { ok: true }

    const invoiceId = obj?.metadata?.invoiceId
    const byPayment = await this.prisma.saaSInvoice.findFirst({ where: { providerPaymentId: obj.id } })
    const invoice = byPayment || (invoiceId ? await this.prisma.saaSInvoice.findUnique({ where: { id: invoiceId } }) : null)
    if (!invoice) return { ok: true }

    if (event === 'payment.succeeded') {
      await this.prisma.$transaction(async (tx) => {
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
        const paidUntil = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

        await tx.tenant.update({
          where: { id: invoice.tenantId },
          data: {
            saasSubscriptionStatus: 'ACTIVE',
            saasPlan: invoice.plan,
            saasPaidUntil: paidUntil,
          },
        })
      })
    } else if (event === 'payment.canceled' || event === 'payment.waiting_for_capture') {
      await this.prisma.saaSInvoice.update({
        where: { id: invoice.id },
        data: {
          status: event === 'payment.canceled' ? 'CANCELED' : 'PENDING',
          providerResponse: payload,
        },
      })
    }

    return { ok: true }
  }
}
