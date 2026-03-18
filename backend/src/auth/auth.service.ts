import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { EmailService } from '../notifications/email.service'
import { RegisterSaasDto } from './dto/register-saas.dto'

type MonthPattern = {
  rentals: number
  avgRate: number
  expense: number
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  private async clearExpiredResetTokens() {
    await this.prisma.user.updateMany({
      where: {
        passwordResetExpiresAt: { lte: new Date() },
        passwordResetTokenHash: { not: null },
      },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    })
  }

  private async audit(userId: string | undefined, action: string, targetType: string, targetId?: string, details?: any) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        details: details ?? undefined,
      },
    })
  }

  async registerRequest(email: string, password: string, fullName?: string, phone?: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует')

    const existingReq = await this.prisma.registrationRequest.findUnique({ where: { email } })
    if (existingReq && existingReq.status === 'PENDING') {
      throw new BadRequestException('Заявка с таким email уже отправлена')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (existingReq) {
      await this.prisma.registrationRequest.update({
        where: { email },
        data: {
          passwordHash,
          fullName: fullName ?? null,
          phone: phone ?? null,
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
        },
      })
    } else {
      await this.prisma.registrationRequest.create({
        data: { email, passwordHash, fullName: fullName ?? null, phone: phone ?? null },
      })
    }

    return { ok: true }
  }

  async registerSaas(dto: RegisterSaasDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует')

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const created = await this.prisma.$transaction(async (tx) => {
      const franchisee = await tx.franchisee.create({
        data: {
          name: dto.companyName,
          companyName: dto.companyName,
          city: dto.city ?? null,
          isActive: true,
        },
      })

      const tenant = await tx.tenant.create({
        data: {
          franchiseeId: franchisee.id,
          name: dto.tenantName?.trim() || `${dto.companyName} — точка 1`,
          isActive: true,
          mode: 'SAAS',
          dailyRateRub: 500,
          minRentalDays: 7,
          royaltyPercent: 0,
          saasPlan: 'STARTER',
          saasSubscriptionStatus: 'TRIAL',
          saasTrialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      })

      const user = await tx.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone ?? null,
          passwordHash,
          role: 'SAAS_USER',
          franchiseeId: franchisee.id,
          isActive: true,
        },
      })

      await tx.userTenant.create({
        data: { userId: user.id, tenantId: tenant.id },
      })

      return { user, tenant, franchisee }
    })

    const payload = {
      userId: created.user.id,
      role: created.user.role,
      franchiseeId: created.user.franchiseeId ?? null,
      tokenVersion: created.user.tokenVersion ?? 0,
    }

    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      tenantId: created.tenant.id,
      user: {
        id: created.user.id,
        email: created.user.email,
        role: created.user.role,
      },
      tenant: {
        id: created.tenant.id,
        name: created.tenant.name,
        mode: created.tenant.mode,
      },
      franchisee: {
        id: created.franchisee.id,
        name: created.franchisee.name,
      },
    }
  }

  async login(email: string, password: string, ip?: string | null, userAgent?: string | null) {
    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
        lastLoginUserAgent: userAgent ?? null,
      },
    })

    const payload = {
      userId: user.id,
      role: user.role,
      franchiseeId: user.franchiseeId ?? null,
      tokenVersion: user.tokenVersion ?? 0,
    }

    const accessToken = await this.jwt.signAsync(payload)
    return { accessToken }
  }

  async requestPasswordReset(email: string) {
    await this.clearExpiredResetTokens()

    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) return { ok: true }

    const token = randomBytes(24).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    })

    await this.audit(undefined, 'PASSWORD_RESET_REQUEST', 'USER', user.id, {
      email: user.email,
      expiresAt,
    })

    if (user.email) {
      await this.email.sendPasswordReset(user.email, token)
    }

    return { ok: true, resetToken: token }
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex')

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
        isActive: true,
      },
    })

    if (!user) throw new BadRequestException('Ссылка сброса недействительна или истекла')

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    })

    await this.audit(user.id, 'PASSWORD_RESET_CONFIRM', 'USER', user.id)
    return { ok: true }
  }

  private monthStarts(from: Date, to: Date) {
    const out: Date[] = []
    const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))
    while (cur.getTime() <= end.getTime()) {
      out.push(new Date(cur))
      cur.setUTCMonth(cur.getUTCMonth() + 1)
    }
    return out
  }

  private rint(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private pick<T>(arr: T[]): T {
    return arr[this.rint(0, arr.length - 1)]
  }

  private fakeClientName() {
    const first = ['Алекс', 'Макс', 'Ник', 'Лев', 'Мир', 'Арс', 'Тим', 'Рэн', 'Дан', 'Кир', 'Сэм', 'Роб']
    const last = ['Северин', 'Громов', 'Леснов', 'Орбитов', 'Ястребов', 'Кедров', 'Лучин', 'Невский', 'Сайферов', 'Ритмов']
    return `${this.pick(first)} ${this.pick(last)}`
  }

  private async loadNnPattern(): Promise<Record<string, MonthPattern>> {
    const now = new Date()
    const from = new Date(Date.UTC(2025, 0, 1))
    const pattern: Record<string, MonthPattern> = {}

    const nnFranchisee = await this.prisma.franchisee.findFirst({
      where: {
        OR: [
          { name: { contains: 'Ниж', mode: 'insensitive' } },
          { companyName: { contains: 'Ниж', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    const months = this.monthStarts(from, now)
    if (!nnFranchisee) {
      months.forEach((m) => {
        pattern[m.toISOString().slice(0, 7)] = {
          rentals: this.rint(22, 55),
          avgRate: this.rint(2200, 3600),
          expense: this.rint(35000, 120000),
        }
      })
      return pattern
    }

    const tenants = await this.prisma.tenant.findMany({ where: { franchiseeId: nnFranchisee.id }, select: { id: true } })
    const tenantIds = tenants.map((t) => t.id)
    if (tenantIds.length === 0) return pattern

    for (const m of months) {
      const monthStart = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1))
      const monthEnd = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))

      const [rentals, paymentsAgg, expensesAgg] = await Promise.all([
        this.prisma.rental.count({
          where: { tenantId: { in: tenantIds }, createdAt: { gte: monthStart, lt: monthEnd } },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          _avg: { amount: true },
          where: { tenantId: { in: tenantIds }, createdAt: { gte: monthStart, lt: monthEnd }, status: 'PAID' },
        }),
        this.prisma.expense.aggregate({
          _sum: { amountRub: true },
          where: { tenantId: { in: tenantIds }, spentAt: { gte: monthStart, lt: monthEnd }, isActive: true },
        }),
      ])

      pattern[m.toISOString().slice(0, 7)] = {
        rentals: Math.max(12, rentals || this.rint(20, 45)),
        avgRate: Math.max(1600, Math.round(Number(paymentsAgg._avg.amount || 2600))),
        expense: Math.max(15000, Math.round(Number(expensesAgg._sum.amountRub || 60000))),
      }
    }

    return pattern
  }


  private isDemoEmail(email: string | null | undefined) {
    if (!email) return false
    return email.startsWith('demo+') && email.endsWith('@rbcrm.local')
  }

  private async cleanupDemoTenant(tx: any, tenantId: string, userId: string, franchiseeId?: string | null) {
    await tx.rentalBattery.deleteMany({ where: { tenantId } })
    await tx.payment.deleteMany({ where: { tenantId } })
    await tx.rentalChange.deleteMany({ where: { tenantId } })
    await tx.document.deleteMany({ where: { tenantId } })
    await tx.rental.deleteMany({ where: { tenantId } })
    await tx.expenseBike.deleteMany({ where: { tenantId } })
    await tx.expense.deleteMany({ where: { tenantId } })
    await tx.repair.deleteMany({ where: { tenantId } })
    await tx.battery.deleteMany({ where: { tenantId } })
    await tx.bike.deleteMany({ where: { tenantId } })
    await tx.client.deleteMany({ where: { tenantId } })
    await tx.contractTemplate.deleteMany({ where: { tenantId } })

    await tx.tenant.updateMany({
      where: { id: tenantId },
      data: { isActive: false, name: `DEMO_CLOSED_${tenantId.slice(0, 8)}` },
    })

    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    })

    if (franchiseeId) {
      await tx.franchisee.update({
        where: { id: franchiseeId },
        data: { isActive: false },
      })
    }
  }

  private async cleanupStaleDemoSessions() {
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const staleUsers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        email: { startsWith: 'demo+' },
        createdAt: { lt: cutoff },
      },
      select: {
        id: true,
        email: true,
        franchiseeId: true,
        userTenants: { select: { tenantId: true } },
      },
      take: 50,
    })

    for (const u of staleUsers) {
      const tenantId = u.userTenants[0]?.tenantId
      if (!tenantId) continue
      await this.prisma.$transaction(async (tx) => {
        await this.cleanupDemoTenant(tx, tenantId, u.id, u.franchiseeId)
      })
      await this.audit(u.id, 'DEMO_STALE_AUTO_CLEANUP', 'TENANT', tenantId)
    }
  }
  async demoAccess() {
    await this.cleanupStaleDemoSessions()

    const slug = Date.now().toString(36)
    const now = new Date()
    const from = new Date(Date.UTC(2025, 0, 1))
    const pattern = await this.loadNnPattern()

    const created = await this.prisma.$transaction(async (tx) => {
      const franchisee = await tx.franchisee.create({
        data: {
          name: `Demo ${slug}`,
          companyName: `Demo ${slug}`,
          city: 'Demo City',
          isActive: true,
        },
      })

      const tenant = await tx.tenant.create({
        data: {
          franchiseeId: franchisee.id,
          name: `Демо точка ${slug}`,
          isActive: true,
          mode: 'SAAS',
          dailyRateRub: 500,
          minRentalDays: 7,
          royaltyPercent: 0,
          saasPlan: 'PRO',
          saasSubscriptionStatus: 'ACTIVE',
        },
      })

      const passwordHash = await bcrypt.hash(randomBytes(12).toString('hex'), 10)
      const user = await tx.user.create({
        data: {
          email: `demo+${slug}@rbcrm.local`,
          fullName: 'Demo User',
          passwordHash,
          role: 'SAAS_USER',
          franchiseeId: franchisee.id,
          isActive: true,
        },
      })

      await tx.userTenant.create({ data: { userId: user.id, tenantId: tenant.id } })

      const bikeCount = this.rint(28, 54)
      const bikeRows = Array.from({ length: bikeCount }).map((_, i) => ({
        tenantId: tenant.id,
        code: `D-${slug.slice(-4).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        model: this.pick(['Urban X', 'City Pro', 'Volt Go', 'Flex Ride']),
        status: 'AVAILABLE' as const,
        isActive: true,
      }))
      await tx.bike.createMany({ data: bikeRows })
      const bikes = await tx.bike.findMany({ where: { tenantId: tenant.id }, select: { id: true, code: true } })

      const clientCount = this.rint(160, 320)
      const clientRows = Array.from({ length: clientCount }).map((_, i) => ({
        tenantId: tenant.id,
        fullName: this.fakeClientName(),
        phone: `+7999${String(this.rint(1000000, 9999999))}`,
        address: `Улица ${this.rint(1, 99)}, д. ${this.rint(1, 40)}`,
        isActive: true,
        notes: i % 7 === 0 ? 'Демо заметка' : null,
      }))
      await tx.client.createMany({ data: clientRows })
      const clients = await tx.client.findMany({ where: { tenantId: tenant.id }, select: { id: true } })

      const months = this.monthStarts(from, now)
      for (const m of months) {
        const key = m.toISOString().slice(0, 7)
        const p = pattern[key] || {
          rentals: this.rint(20, 45),
          avgRate: this.rint(2000, 3300),
          expense: this.rint(30000, 90000),
        }

        const monthStart = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1))
        const monthEnd = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
        const cappedEnd = monthEnd.getTime() > now.getTime() ? now : monthEnd
        const days = Math.max(1, Math.floor((cappedEnd.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)))

        const rentalsTarget = Math.max(8, Math.round(p.rentals * (0.9 + Math.random() * 0.25)))

        for (let i = 0; i < rentalsTarget; i++) {
          const startOffset = this.rint(0, Math.max(0, days - 2))
          const startDate = new Date(monthStart.getTime() + startOffset * 24 * 60 * 60 * 1000)
          const duration = this.rint(7, 35)
          const plannedEndDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000)
          const stillActive = plannedEndDate.getTime() > now.getTime() && Math.random() < 0.45
          const status = stillActive ? 'ACTIVE' : 'CLOSED'
          const actualEndDate = status === 'CLOSED' ? plannedEndDate : null
          const weeklyRateRub = Math.round(p.avgRate * (0.8 + Math.random() * 0.5))

          const rental = await tx.rental.create({
            data: {
              tenantId: tenant.id,
              bikeId: this.pick(bikes).id,
              clientId: this.pick(clients).id,
              startDate,
              plannedEndDate,
              actualEndDate,
              weeklyRateRub,
              status,
              createdById: user.id,
            },
          })

          const paymentsN = status === 'CLOSED' ? this.rint(1, 4) : this.rint(1, 2)
          for (let pi = 0; pi < paymentsN; pi++) {
            const periodStart = new Date(startDate.getTime() + pi * 7 * 24 * 60 * 60 * 1000)
            const periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
            const dueAt = new Date(periodEnd)
            if (dueAt.getTime() > now.getTime()) break
            const paid = Math.random() > 0.08

            await tx.payment.create({
              data: {
                tenantId: tenant.id,
                rentalId: rental.id,
                amount: Math.round(weeklyRateRub * (0.9 + Math.random() * 0.25)),
                kind: 'WEEKLY_RENT',
                status: paid ? 'PAID' : 'PLANNED',
                dueAt,
                periodStart,
                periodEnd,
                paidAt: paid ? new Date(dueAt.getTime() + this.rint(0, 2) * 24 * 60 * 60 * 1000) : null,
                markedById: paid ? user.id : null,
              },
            })
          }
        }

        const expenseRows = Array.from({ length: this.rint(3, 8) }).map(() => ({
          tenantId: tenant.id,
          amountRub: Math.round((p.expense / 5) * (0.4 + Math.random() * 1.3)),
          category: this.pick(['Сервис', 'Логистика', 'Расходники', 'Маркетинг', 'Прочее']),
          notes: 'Демо-операция',
          spentAt: new Date(monthStart.getTime() + this.rint(0, Math.max(0, days - 1)) * 24 * 60 * 60 * 1000),
          scopeType: this.pick(['SINGLE', 'MULTI', 'ALL_BIKES'] as const),
          isActive: true,
          createdById: user.id,
        }))
        await tx.expense.createMany({ data: expenseRows })
      }

      return { user, tenant }
    })

    const payload = {
      userId: created.user.id,
      role: created.user.role,
      franchiseeId: created.user.franchiseeId ?? null,
      tokenVersion: created.user.tokenVersion ?? 0,
    }

    const accessToken = await this.jwt.signAsync(payload)

    await this.audit(created.user.id, 'DEMO_ACCESS_ISSUED', 'TENANT', created.tenant.id, {
      tenantId: created.tenant.id,
      userId: created.user.id,
      rangeFrom: '2025-01-01',
      rangeTo: new Date().toISOString(),
      randomized: true,
      sourcePattern: 'NN franchise aggregates when available',
    })

    return {
      accessToken,
      tenantId: created.tenant.id,
      demo: true,
      dataRange: { from: '2025-01-01', to: new Date().toISOString() },
    }
  }
}
