import { BadRequestException, Injectable } from '@nestjs/common'
import { PaymentKind, PaymentStatus, RentalStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const WEEK_DAYS = 7

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function toDate(value: string, name: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${name} must be a valid date`)
  }
  return d
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

@Injectable()
export class WeeklyPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateWeekly(tenantId: string, fromRaw: string, toRaw: string) {
    const from = toDate(fromRaw, 'from')
    const to = toDate(toRaw, 'to')

    if (to <= from) {
      throw new BadRequestException('to must be greater than from')
    }

    const rentals = await this.prisma.rental.findMany({
      where: {
        tenantId,
        status: RentalStatus.ACTIVE,
      },
      include: {
        client: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    let created = 0
    let skipped = 0
    const details: Array<{ rentalId: string; client: string; created: number; skipped: number }> = []

    for (const rental of rentals) {
      if (rental.weeklyRateRub <= 0) {
        skipped += 1
        details.push({
          rentalId: rental.id,
          client: rental.client.fullName,
          created: 0,
          skipped: 1,
        })
        continue
      }

      let blockStart = new Date(rental.startDate)
      let localCreated = 0
      let localSkipped = 0
      const rentalStop = rental.actualEndDate ?? rental.plannedEndDate

      while (blockStart < to && blockStart < rentalStop) {
        const blockEnd = addDays(blockStart, WEEK_DAYS)

        const intersectsRange = blockEnd > from && blockStart < to

        if (intersectsRange) {
          const existing = await this.prisma.payment.findFirst({
            where: {
              tenantId,
              rentalId: rental.id,
              kind: PaymentKind.WEEKLY_RENT,
              periodStart: blockStart,
            },
            select: { id: true },
          })

          if (existing) {
            skipped += 1
            localSkipped += 1
          } else {
            await this.prisma.payment.create({
              data: {
                tenantId,
                rentalId: rental.id,
                amount: round2(rental.weeklyRateRub),
                kind: PaymentKind.WEEKLY_RENT,
                status: PaymentStatus.PLANNED,
                dueAt: blockStart,
                periodStart: blockStart,
                periodEnd: blockEnd,
              },
            })
            created += 1
            localCreated += 1
          }
        }

        blockStart = blockEnd
      }

      details.push({
        rentalId: rental.id,
        client: rental.client.fullName,
        created: localCreated,
        skipped: localSkipped,
      })
    }

    return {
      tenantId,
      from,
      to,
      rentalsChecked: rentals.length,
      created,
      skipped,
      details,
    }
  }

  async debts(tenantId: string, overdueOnly = true) {
    const now = new Date()

    const planned = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: PaymentStatus.PLANNED,
        ...(overdueOnly
          ? {
              dueAt: {
                lt: now,
              },
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        rental: {
          select: {
            id: true,
            client: { select: { id: true, fullName: true, phone: true } },
            bike: { select: { id: true, code: true } },
          },
        },
      },
    })

    const totalDebtRub = round2(planned.reduce((sum, p) => sum + p.amount, 0))

    return {
      tenantId,
      currency: 'RUB',
      overdueOnly,
      count: planned.length,
      totalDebtRub,
      items: planned.map((p) => ({
        paymentId: p.id,
        rentalId: p.rentalId,
        clientId: p.rental.client.id,
        clientName: p.rental.client.fullName,
        clientPhone: p.rental.client.phone,
        bikeCode: p.rental.bike.code,
        amountRub: round2(p.amount),
        kind: p.kind,
        dueAt: p.dueAt,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        createdAt: p.createdAt,
      })),
    }
  }
}
