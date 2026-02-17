import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { BikeStatus, PaymentKind, PaymentStatus, RentalChangeType, RentalStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { AddRentalBatteryDto } from './dto/add-rental-battery.dto'
import { CloseRentalDto } from './dto/close-rental.dto'
import { CreateRentalDto } from './dto/create-rental.dto'
import { ExtendRentalDto } from './dto/extend-rental.dto'
import { ReplaceRentalBatteryDto } from './dto/replace-rental-battery.dto'
import { UpdateWeeklyRateDto } from './dto/update-weekly-rate.dto'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const DEFAULT_MIN_RENTAL_DAYS = 7
const DEFAULT_DAILY_RENT_RUB = 500
const WEEK_DAYS = 7

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function diffDaysCeil(from: Date, to: Date) {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY))
}

@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class RentalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Req() req: Request, @CurrentUser() user: JwtUser, @Body() dto: CreateRentalDto) {
    const tenantId = req.tenantId!

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dailyRateRub: true, minRentalDays: true },
    })
    const dailyRateRub = tenant?.dailyRateRub ?? DEFAULT_DAILY_RENT_RUB
    const minRentalDays = tenant?.minRentalDays ?? DEFAULT_MIN_RENTAL_DAYS

    const startDate = new Date(dto.startDate)
    const plannedEndDate = new Date(dto.plannedEndDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(plannedEndDate.getTime())) {
      throw new BadRequestException('Invalid dates')
    }

    const diffDays = Math.ceil((plannedEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < minRentalDays) {
      throw new BadRequestException(`Minimum rental duration is ${minRentalDays} days`)
    }

    const bike = await this.prisma.bike.findFirst({
      where: { id: dto.bikeId, tenantId },
    })

    if (!bike) {
      throw new BadRequestException('Bike not found for current tenant')
    }

    if (bike.status !== BikeStatus.AVAILABLE) {
      throw new BadRequestException('Bike is not available')
    }

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, tenantId },
      select: { id: true },
    })

    if (!client) {
      throw new BadRequestException('Client not found for current tenant')
    }

    const existingActiveRental = await this.prisma.rental.findFirst({
      where: {
        tenantId,
        clientId: dto.clientId,
        status: RentalStatus.ACTIVE,
      },
      select: { id: true },
    })

    if (existingActiveRental) {
      throw new BadRequestException('Client already has an ACTIVE rental')
    }

    const batteries = await this.prisma.battery.findMany({
      where: {
        tenantId,
        isActive: true,
        id: { in: dto.batteryIds || [] },
      },
      select: { id: true, status: true },
    })

    if (!dto.batteryIds?.length) {
      throw new BadRequestException('At least one battery is required')
    }
    if (dto.batteryIds.length > 2) {
      throw new BadRequestException('Maximum 2 batteries can be issued')
    }
    if (new Set(dto.batteryIds).size !== dto.batteryIds.length) {
      throw new BadRequestException('Battery ids must be unique')
    }

    if (batteries.length !== dto.batteryIds.length) {
      throw new BadRequestException('Some selected batteries were not found for this bike')
    }

    if (batteries.some((b) => b.status !== 'AVAILABLE')) {
      throw new BadRequestException('All selected batteries must be AVAILABLE')
    }

    const rental = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rental.create({
        data: {
          tenantId,
          bikeId: dto.bikeId,
          clientId: dto.clientId,
          startDate,
          plannedEndDate,
          status: RentalStatus.ACTIVE,
          weeklyRateRub: dailyRateRub * 7,
          createdById: user.userId,
        },
      })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: created.id,
          type: RentalChangeType.EXTEND,
          daysDelta: diffDays,
          reason: 'Создание аренды',
          createdById: user.userId,
        },
      })

      await tx.bike.update({
        where: { id: dto.bikeId },
        data: { status: BikeStatus.RENTED },
      })

      await tx.payment.create({
        data: {
          tenantId,
          rentalId: created.id,
          amount: round2(diffDays * dailyRateRub),
          kind: PaymentKind.MANUAL,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          dueAt: startDate,
          periodStart: startDate,
          periodEnd: plannedEndDate,
          markedById: user.userId,
        },
      })

      await tx.rentalBattery.createMany({
        data: dto.batteryIds.map((batteryId) => ({ tenantId, rentalId: created.id, batteryId })),
      })

      await tx.battery.updateMany({
        where: { tenantId, id: { in: dto.batteryIds } },
        data: { status: 'RENTED', bikeId: dto.bikeId },
      })

      return created
    })

    return rental
  }

  @Get()
  async list(@Req() req: Request, @Query('status') status?: string) {
    const tenantId = req.tenantId!
    const statusFilter = status === 'ACTIVE' || status === 'CLOSED' ? (status as RentalStatus) : undefined

    const rows = await this.prisma.rental.findMany({
      where: {
        tenantId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        status: true,
        startDate: true,
        plannedEndDate: true,
        actualEndDate: true,
        weeklyRateRub: true,
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
        batteries: {
          select: {
            battery: { select: { id: true, code: true } },
          },
        },
        changes: {
          where: { type: RentalChangeType.CLOSE },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { reason: true },
        },
      },
    })

    return rows.map((r) => ({ ...r, closeReason: r.changes[0]?.reason ?? null }))
  }

  @Get('active')
  async active(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.list(req, 'ACTIVE')
  }

  @Post(':id/extend')
  async extend(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ExtendRentalDto,
  ) {
    const tenantId = req.tenantId!

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dailyRateRub: true },
    })
    const dailyRateRub = tenant?.dailyRateRub ?? DEFAULT_DAILY_RENT_RUB

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, plannedEndDate: true },
    })

    if (!rental) {
      throw new NotFoundException('Rental not found')
    }

    if (rental.status !== RentalStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE rental can be extended')
    }

    const days = dto.days
    const newPlannedEndDate = addDays(rental.plannedEndDate, days)

    await this.prisma.$transaction(async (tx) => {
      await tx.rental.updateMany({
        where: { id, tenantId },
        data: { plannedEndDate: newPlannedEndDate },
      })

      await tx.payment.create({
        data: {
          tenantId,
          rentalId: id,
          amount: round2(days * dailyRateRub),
          kind: PaymentKind.MANUAL,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
          dueAt: rental.plannedEndDate,
          periodStart: rental.plannedEndDate,
          periodEnd: newPlannedEndDate,
          markedById: user.userId,
        },
      })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: id,
          type: RentalChangeType.EXTEND,
          daysDelta: days,
          reason: 'Продление аренды',
          createdById: user.userId,
        },
      })
    })

    return this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, plannedEndDate: true },
    })
  }

  @Post(':id/batteries')
  async addBattery(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AddRentalBatteryDto,
  ) {
    const tenantId = req.tenantId!

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId, status: RentalStatus.ACTIVE },
      select: { id: true, bikeId: true },
    })
    if (!rental) throw new NotFoundException('Active rental not found')

    const current = await this.prisma.rentalBattery.findMany({
      where: { tenantId, rentalId: id },
      select: { batteryId: true },
    })
    if (current.some((x) => x.batteryId === dto.batteryId)) {
      throw new BadRequestException('Battery already assigned to rental')
    }
    if (current.length >= 2) {
      throw new BadRequestException('Cannot assign more than 2 batteries')
    }

    const battery = await this.prisma.battery.findFirst({
      where: { id: dto.batteryId, tenantId, isActive: true },
      select: { id: true, status: true },
    })
    if (!battery) throw new NotFoundException('Battery not found')
    if (battery.status !== 'AVAILABLE') throw new BadRequestException('Battery is not AVAILABLE')

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalBattery.create({ data: { tenantId, rentalId: id, batteryId: dto.batteryId } })
      await tx.battery.updateMany({ where: { tenantId, id: dto.batteryId }, data: { status: 'RENTED', bikeId: rental.bikeId } })
      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: id,
          type: RentalChangeType.SHORTEN,
          daysDelta: 0,
          reason: `АКБ: добавлена ${dto.batteryId}`,
          createdById: user.userId,
        },
      })
    })

    return { rentalId: id, addedBatteryId: dto.batteryId }
  }

  @Post(':id/batteries/replace')
  async replaceBattery(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReplaceRentalBatteryDto,
  ) {
    const tenantId = req.tenantId!

    if (dto.removeBatteryId === dto.addBatteryId) {
      throw new BadRequestException('removeBatteryId and addBatteryId must differ')
    }

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId, status: RentalStatus.ACTIVE },
      select: { id: true, bikeId: true },
    })
    if (!rental) throw new NotFoundException('Active rental not found')

    const removeLink = await this.prisma.rentalBattery.findFirst({
      where: { tenantId, rentalId: id, batteryId: dto.removeBatteryId },
      select: { id: true },
    })
    if (!removeLink) throw new BadRequestException('Removed battery is not assigned to rental')

    const addBattery = await this.prisma.battery.findFirst({
      where: { id: dto.addBatteryId, tenantId, isActive: true },
      select: { id: true, status: true },
    })
    if (!addBattery) throw new NotFoundException('Added battery not found')
    if (addBattery.status !== 'AVAILABLE') throw new BadRequestException('Added battery is not AVAILABLE')

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalBattery.deleteMany({ where: { tenantId, rentalId: id, batteryId: dto.removeBatteryId } })
      await tx.battery.updateMany({ where: { tenantId, id: dto.removeBatteryId }, data: { status: 'AVAILABLE', bikeId: null } })

      await tx.rentalBattery.create({ data: { tenantId, rentalId: id, batteryId: dto.addBatteryId } })
      await tx.battery.updateMany({ where: { tenantId, id: dto.addBatteryId }, data: { status: 'RENTED', bikeId: rental.bikeId } })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: id,
          type: RentalChangeType.SHORTEN,
          daysDelta: 0,
          reason: `АКБ: замена ${dto.removeBatteryId} -> ${dto.addBatteryId}`,
          createdById: user.userId,
        },
      })
    })

    return { rentalId: id, replaced: true }
  }

  @Get(':id/journal')
  async journal(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        createdAt: true,
        startDate: true,
        plannedEndDate: true,
        actualEndDate: true,
        client: { select: { fullName: true } },
        bike: { select: { code: true } },
      },
    })

    if (!rental) throw new NotFoundException('Rental not found')

    const [changes, payments] = await Promise.all([
      this.prisma.rentalChange.findMany({
        where: { tenantId, rentalId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { tenantId, rentalId: id, status: PaymentStatus.PAID },
        orderBy: { paidAt: 'asc' },
      }),
    ])

    const events: Array<{ at: Date; type: string; details: string }> = []

    events.push({
      at: rental.createdAt,
      type: 'СОЗДАНА_АРЕНДА',
      details: `${rental.client.fullName} / ${rental.bike.code}`,
    })

    for (const c of changes) {
      if (c.type === RentalChangeType.EXTEND && c.reason?.includes('Создание')) continue
      if (c.type === RentalChangeType.EXTEND) {
        events.push({ at: c.createdAt, type: 'ПРОДЛЕНА', details: `+${c.daysDelta} дн.` })
      } else if (c.type === RentalChangeType.CLOSE) {
        events.push({ at: c.createdAt, type: 'ЗАКРЫТА_ДОСРОЧНО', details: c.reason ?? '' })
      } else if (c.reason?.startsWith('АКБ:')) {
        events.push({ at: c.createdAt, type: 'АКБ', details: c.reason })
      }
    }

    for (const p of payments) {
      if (p.amount < 0) {
        events.push({ at: p.paidAt ?? p.createdAt, type: 'ВОЗВРАТ', details: `${p.amount} RUB` })
      } else {
        events.push({ at: p.paidAt ?? p.createdAt, type: 'ОПЛАТА', details: `${p.amount} RUB` })
      }
    }

    events.sort((a, b) => a.at.getTime() - b.at.getTime())

    return {
      rentalId: rental.id,
      events,
    }
  }

  @Post(':id/close')
  async close(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CloseRentalDto,
  ) {
    const tenantId = req.tenantId!

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        bikeId: true,
        startDate: true,
        plannedEndDate: true,
      },
    })

    if (!rental) {
      throw new NotFoundException('Rental not found')
    }

    if (rental.status !== RentalStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE rental can be closed')
    }

    const reason = dto.reason?.trim()
    if (!reason) throw new BadRequestException('Reason is required')

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { dailyRateRub: true },
    })
    const dailyRateRub = tenant?.dailyRateRub ?? DEFAULT_DAILY_RENT_RUB

    const closedAt = new Date()

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.rental.updateMany({
        where: { id, tenantId },
        data: {
          status: RentalStatus.CLOSED,
          actualEndDate: closedAt,
        },
      })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: id,
          type: RentalChangeType.CLOSE,
          daysDelta: 0,
          reason,
          createdById: user.userId,
        },
      })

      await tx.bike.updateMany({
        where: { id: rental.bikeId, tenantId },
        data: { status: BikeStatus.AVAILABLE },
      })

      const paid = await tx.payment.aggregate({
        where: {
          tenantId,
          rentalId: rental.id,
          status: PaymentStatus.PAID,
        },
        _sum: { amount: true },
      })

      const paidRub = round2(paid._sum.amount ?? 0)
      const actualDays = diffDaysCeil(rental.startDate, closedAt)
      const shouldPayRub = round2(actualDays * dailyRateRub)
      const refundRub = round2(Math.max(0, paidRub - shouldPayRub))

      if (refundRub > 0) {
        await tx.payment.create({
          data: {
            tenantId,
            rentalId: rental.id,
            amount: -refundRub,
            kind: PaymentKind.MANUAL,
            status: PaymentStatus.PAID,
            paidAt: closedAt,
            dueAt: closedAt,
            periodStart: closedAt,
            periodEnd: rental.plannedEndDate,
            markedById: user.userId,
          },
        })
      }

      const rentalBatteries = await tx.rentalBattery.findMany({ where: { tenantId, rentalId: rental.id }, select: { batteryId: true } })
      if (rentalBatteries.length) {
        await tx.battery.updateMany({
          where: { tenantId, id: { in: rentalBatteries.map((x) => x.batteryId) } },
          data: { status: 'AVAILABLE', bikeId: null },
        })
      }

      return {
        paidRub,
        shouldPayRub,
        refundRub,
        actualDays,
      }
    })

    const updated = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        actualEndDate: true,
        client: { select: { fullName: true } },
        bike: { select: { code: true, status: true } },
      },
    })

    return {
      ...updated,
      finance: result,
    }
  }

  @Post(':id/recalculate-weekly-payments')
  async recalculateWeeklyPayments(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        startDate: true,
        plannedEndDate: true,
        actualEndDate: true,
        weeklyRateRub: true,
        status: true,
      },
    })

    if (!rental) {
      throw new NotFoundException('Rental not found')
    }

    if (rental.weeklyRateRub <= 0) {
      throw new BadRequestException('weeklyRateRub must be greater than 0')
    }

    const rentalStop = rental.actualEndDate ?? rental.plannedEndDate

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({
        where: {
          tenantId,
          rentalId: rental.id,
          kind: PaymentKind.WEEKLY_RENT,
          status: PaymentStatus.PLANNED,
        },
      })

      let blockStart = new Date(rental.startDate)
      let created = 0

      while (blockStart < rentalStop) {
        const nominalBlockEnd = addDays(blockStart, WEEK_DAYS)
        const blockEnd = nominalBlockEnd < rentalStop ? nominalBlockEnd : rentalStop

        const daysInBlock = Math.max(
          1,
          Math.ceil((blockEnd.getTime() - blockStart.getTime()) / MS_PER_DAY),
        )

        const amount = round2((rental.weeklyRateRub / 7) * daysInBlock)

        await tx.payment.create({
          data: {
            tenantId,
            rentalId: rental.id,
            amount,
            kind: PaymentKind.WEEKLY_RENT,
            status: PaymentStatus.PLANNED,
            dueAt: blockStart,
            periodStart: blockStart,
            periodEnd: blockEnd,
          },
        })

        created += 1
        blockStart = blockEnd
      }

      return { created }
    })

    return {
      rentalId: rental.id,
      weeklyRateRub: rental.weeklyRateRub,
      createdPayments: result.created,
    }
  }

  @Patch(':id/weekly-rate')
  async setWeeklyRate(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyRateDto,
  ) {
    const tenantId = req.tenantId!

    if (!Number.isFinite(dto.weeklyRateRub)) {
      throw new BadRequestException('weeklyRateRub must be a number')
    }

    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    })

    if (!rental) {
      throw new NotFoundException('Rental not found')
    }

    if (rental.status !== RentalStatus.ACTIVE) {
      throw new BadRequestException('Weekly rate can be updated only for ACTIVE rentals')
    }

    const result = await this.prisma.rental.updateMany({
      where: { id, tenantId },
      data: { weeklyRateRub: dto.weeklyRateRub },
    })

    if (result.count === 0) {
      throw new NotFoundException('Rental not found')
    }

    return this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        weeklyRateRub: true,
        status: true,
        client: {
          select: { id: true, fullName: true },
        },
        bike: {
          select: { id: true, code: true },
        },
      },
    })
  }
}
