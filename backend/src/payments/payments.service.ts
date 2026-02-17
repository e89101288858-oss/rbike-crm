import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PaymentKind, PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto'
import { UpdatePaymentDto } from './dto/update-payment.dto'

function toDate(value?: string) {
  if (!value) return undefined
  return new Date(value)
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListPaymentsQueryDto) {
    const dueFrom = toDate(query.dueFrom)
    const dueTo = toDate(query.dueTo)

    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status as PaymentStatus } : {}),
        ...(query.kind ? { kind: query.kind as PaymentKind } : {}),
        ...(query.rentalId ? { rentalId: query.rentalId } : {}),
        ...(query.clientId
          ? {
              rental: {
                clientId: query.clientId,
              },
            }
          : {}),
        ...(dueFrom || dueTo
          ? {
              dueAt: {
                ...(dueFrom ? { gte: dueFrom } : {}),
                ...(dueTo ? { lte: dueTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        rental: {
          select: {
            id: true,
            status: true,
            client: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
            bike: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    })
  }

  async revenueByBike(tenantId: string, from?: string, to?: string, bikeId?: string) {
    const fromDate = toDate(from)
    const toDateValue = toDate(to)

    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAID,
        ...(bikeId ? { rental: { bikeId } } : {}),
        ...(fromDate || toDateValue
          ? {
              paidAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDateValue ? { lte: toDateValue } : {}),
              },
            }
          : {}),
      },
      select: {
        amount: true,
        rental: {
          select: {
            bike: {
              select: {
                id: true,
                code: true,
                model: true,
              },
            },
          },
        },
      },
    })

    const map = new Map<string, { bikeId: string; bikeCode: string; model: string | null; revenueRub: number; payments: number }>()

    for (const row of rows) {
      const bike = row.rental.bike
      const current = map.get(bike.id) ?? {
        bikeId: bike.id,
        bikeCode: bike.code,
        model: bike.model,
        revenueRub: 0,
        payments: 0,
      }
      current.revenueRub = Math.round((current.revenueRub + row.amount) * 100) / 100
      current.payments += 1
      map.set(bike.id, current)
    }

    const items = Array.from(map.values()).sort((a, b) => b.revenueRub - a.revenueRub)
    const totalRevenueRub = Math.round(items.reduce((sum, i) => sum + i.revenueRub, 0) * 100) / 100

    return {
      tenantId,
      currency: 'RUB',
      from: fromDate ?? null,
      to: toDateValue ?? null,
      bikeId: bikeId ?? null,
      bikes: items,
      totalRevenueRub,
    }
  }

  async revenueByDays(tenantId: string, from?: string, to?: string) {
    const fromDate = toDate(from)
    const toDateValue = toDate(to)

    const rows = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PAID,
        ...(fromDate || toDateValue
          ? {
              paidAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDateValue ? { lte: toDateValue } : {}),
              },
            }
          : {}),
      },
      select: {
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'asc' },
    })

    const map = new Map<string, number>()
    for (const row of rows) {
      if (!row.paidAt) continue
      const key = row.paidAt.toISOString().slice(0, 10)
      map.set(key, Math.round(((map.get(key) ?? 0) + row.amount) * 100) / 100)
    }

    const days = Array.from(map.entries())
      .map(([date, revenueRub]) => ({ date, revenueRub }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      tenantId,
      currency: 'RUB',
      from: fromDate ?? null,
      to: toDateValue ?? null,
      days,
      totalRevenueRub: Math.round(days.reduce((s, d) => s + d.revenueRub, 0) * 100) / 100,
    }
  }

  async update(tenantId: string, id: string, dto: UpdatePaymentDto) {
    const existing = await this.prisma.payment.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Payment not found')

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : undefined
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : undefined
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined

    if (periodStart && periodEnd && periodStart > periodEnd) {
      throw new BadRequestException('periodStart must be <= periodEnd')
    }

    const status = dto.status as PaymentStatus | undefined

    await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dueAt !== undefined && { dueAt }),
        ...(periodStart !== undefined && { periodStart }),
        ...(periodEnd !== undefined && { periodEnd }),
        ...(status !== undefined && { status }),
        ...(paidAt !== undefined && { paidAt }),
        ...(status === PaymentStatus.PLANNED ? { paidAt: null, markedById: null } : {}),
      },
    })

    return this.prisma.payment.findFirst({ where: { id, tenantId } })
  }

  async remove(tenantId: string, id: string) {
    const existing = await this.prisma.payment.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Payment not found')

    await this.prisma.payment.deleteMany({ where: { id, tenantId } })
    return { id, deleted: true }
  }

  async markPaid(tenantId: string, id: string, userId: string) {
    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        markedById: userId,
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Payment not found')
    }

    return this.prisma.payment.findFirst({
      where: { id, tenantId },
    })
  }

  async markPlanned(tenantId: string, id: string) {
    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PLANNED,
        paidAt: null,
        markedById: null,
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Payment not found')
    }

    return this.prisma.payment.findFirst({
      where: { id, tenantId },
    })
  }
}
