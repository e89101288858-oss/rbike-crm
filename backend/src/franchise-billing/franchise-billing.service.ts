import { Injectable } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const ROYALTY_RATE = 0.05

function toMonthRange(month?: string) {
  const now = new Date()

  const source = month
    ? new Date(`${month}-01T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))

  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  const monthLabel = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`

  return { start, end, monthLabel }
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

@Injectable()
export class FranchiseBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async buildOwnerMonthlyReport(month?: string, includeZero = false) {
    const { start, end, monthLabel } = toMonthRange(month)

    const [tenants, paidByTenant] = await Promise.all([
      this.prisma.tenant.findMany({
        include: {
          franchisee: {
            select: { id: true, name: true },
          },
        },
        orderBy: [{ franchisee: { name: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.payment.groupBy({
        by: ['tenantId'],
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: start,
            lt: end,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    const paidMap = new Map(paidByTenant.map((row) => [row.tenantId, row]))

    const tenantRows = tenants
      .map((tenant) => {
        const row = paidMap.get(tenant.id)
        const revenue = row?._sum.amount ?? 0
        const royaltyDue = round2(revenue * ROYALTY_RATE)
        return {
          franchiseeId: tenant.franchiseeId,
          franchiseeName: tenant.franchisee.name,
          tenantId: tenant.id,
          tenantName: tenant.name,
          paidPaymentsCount: row?._count._all ?? 0,
          revenueRub: round2(revenue),
          royaltyRate: ROYALTY_RATE,
          royaltyDueRub: royaltyDue,
        }
      })
      .filter((row) => (includeZero ? true : row.revenueRub > 0))

    const byFranchisee = new Map<
      string,
      { franchiseeId: string; franchiseeName: string; revenueRub: number; royaltyDueRub: number; tenants: number }
    >()

    for (const row of tenantRows) {
      const key = row.franchiseeId
      const current = byFranchisee.get(key) ?? {
        franchiseeId: row.franchiseeId,
        franchiseeName: row.franchiseeName,
        revenueRub: 0,
        royaltyDueRub: 0,
        tenants: 0,
      }

      current.revenueRub = round2(current.revenueRub + row.revenueRub)
      current.royaltyDueRub = round2(current.royaltyDueRub + row.royaltyDueRub)
      current.tenants += 1
      byFranchisee.set(key, current)
    }

    const franchiseeRows = Array.from(byFranchisee.values()).sort((a, b) =>
      a.franchiseeName.localeCompare(b.franchiseeName, 'ru'),
    )

    const totalRevenueRub = round2(tenantRows.reduce((sum, row) => sum + row.revenueRub, 0))
    const totalRoyaltyDueRub = round2(tenantRows.reduce((sum, row) => sum + row.royaltyDueRub, 0))

    return {
      month: monthLabel,
      currency: 'RUB',
      royaltyRate: ROYALTY_RATE,
      summary: {
        tenants: tenantRows.length,
        franchisees: franchiseeRows.length,
        totalRevenueRub,
        totalRoyaltyDueRub,
      },
      franchisees: franchiseeRows,
      tenants: tenantRows,
    }
  }

  async buildFranchiseeMonthlyReport(
    franchiseeId: string,
    month?: string,
    includeZero = false,
  ) {
    const { start, end, monthLabel } = toMonthRange(month)

    const [tenants, paidByTenant] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { franchiseeId },
        orderBy: { name: 'asc' },
      }),
      this.prisma.payment.groupBy({
        by: ['tenantId'],
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: start,
            lt: end,
          },
          tenant: {
            franchiseeId,
          },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])

    const paidMap = new Map(paidByTenant.map((row) => [row.tenantId, row]))

    const tenantRows = tenants
      .map((tenant) => {
        const row = paidMap.get(tenant.id)
        const revenue = row?._sum.amount ?? 0
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          paidPaymentsCount: row?._count._all ?? 0,
          revenueRub: round2(revenue),
          royaltyRate: ROYALTY_RATE,
          royaltyDueRub: round2(revenue * ROYALTY_RATE),
        }
      })
      .filter((row) => (includeZero ? true : row.revenueRub > 0))

    return {
      month: monthLabel,
      currency: 'RUB',
      royaltyRate: ROYALTY_RATE,
      summary: {
        tenants: tenantRows.length,
        totalRevenueRub: round2(tenantRows.reduce((sum, row) => sum + row.revenueRub, 0)),
        totalRoyaltyDueRub: round2(tenantRows.reduce((sum, row) => sum + row.royaltyDueRub, 0)),
      },
      tenants: tenantRows,
    }
  }
}
