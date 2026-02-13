import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { BikeStatus, RentalChangeType, RentalStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRentalDto } from './dto/create-rental.dto'

function addDays(date: Date, days: number) {
  const msPerDay = 1000 * 60 * 60 * 24
  return new Date(date.getTime() + days * msPerDay)
}

function diffDaysCeil(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay)
}

@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateRentalDto) {
    const startDate = new Date(dto.startDate)
    const plannedEndDate = new Date(dto.plannedEndDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(plannedEndDate.getTime())) {
      throw new BadRequestException('Invalid dates')
    }

    const diffDays = diffDaysCeil(startDate, plannedEndDate)
    if (diffDays < 7) {
      throw new BadRequestException('Minimum rental duration is 7 days')
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
    })
    if (!client) {
      throw new BadRequestException('Client not found for current tenant')
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
          createdById: userId,
        },
      })

      // CRITICAL RULE: the only automatic bike status change is here, on successful rental create
      await tx.bike.update({
        where: { id: dto.bikeId },
        data: { status: BikeStatus.RENTED },
      })

      return created
    })

    return rental
  }

  async findAll(tenantId: string) {
    return this.prisma.rental.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        bike: { select: { id: true, code: true } },
        client: { select: { id: true, fullName: true } },
      },
    })
  }

  async findOne(tenantId: string, id: string) {
    const rental = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      include: {
        bike: { select: { id: true, code: true } },
        client: { select: { id: true, fullName: true } },
      },
    })

    if (!rental) {
      throw new NotFoundException('Rental not found')
    }

    return rental
  }

  async extend(
    tenantId: string,
    rentalId: string,
    userId: string,
    days: number,
    reason?: string,
  ) {
    if (!Number.isInteger(days) || days <= 0) {
      throw new BadRequestException('days must be a positive integer')
    }

    return this.prisma.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: { id: rentalId, tenantId },
      })
      if (!rental) throw new NotFoundException('Rental not found')
      if (rental.status !== RentalStatus.ACTIVE) {
        throw new BadRequestException('Only ACTIVE rentals can be changed')
      }

      const newPlannedEndDate = addDays(rental.plannedEndDate, days)

      const updated = await tx.rental.update({
        where: { id: rentalId },
        data: { plannedEndDate: newPlannedEndDate },
      })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId,
          type: RentalChangeType.EXTEND,
          daysDelta: days,
          reason: reason ?? undefined,
          createdById: userId,
        },
      })

      return updated
    })
  }

  async shorten(
    tenantId: string,
    rentalId: string,
    userId: string,
    days: number,
    reason?: string,
  ) {
    if (!Number.isInteger(days) || days <= 0) {
      throw new BadRequestException('days must be a positive integer')
    }

    return this.prisma.$transaction(async (tx) => {
      const rental = await tx.rental.findFirst({
        where: { id: rentalId, tenantId },
      })
      if (!rental) throw new NotFoundException('Rental not found')
      if (rental.status !== RentalStatus.ACTIVE) {
        throw new BadRequestException('Only ACTIVE rentals can be changed')
      }

      const newPlannedEndDate = addDays(rental.plannedEndDate, -days)

      // enforce minimum 7 days total from startDate
      const totalDays = diffDaysCeil(rental.startDate, newPlannedEndDate)
      if (totalDays < 7) {
        throw new BadRequestException('Minimum rental duration is 7 days')
      }

      const updated = await tx.rental.update({
        where: { id: rentalId },
        data: { plannedEndDate: newPlannedEndDate },
      })

      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId,
          type: RentalChangeType.SHORTEN,
          daysDelta: days,
          reason: reason ?? undefined,
          createdById: userId,
        },
      })

      return updated
    })
  }

  async close(tenantId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.rental.findFirst({
        where: { id, tenantId },
      })
      if (!existing) throw new NotFoundException('Rental not found')

      if (existing.status !== RentalStatus.ACTIVE) {
        throw new BadRequestException('Only ACTIVE rentals can be closed')
      }

      const updated = await tx.rental.update({
        where: { id },
        data: {
          status: RentalStatus.CLOSED,
          actualEndDate: new Date(),
        },
      })

      // IMPORTANT: closing must NOT change bike status automatically
      await tx.rentalChange.create({
        data: {
          tenantId,
          rentalId: id,
          type: RentalChangeType.CLOSE,
          daysDelta: 0,
          createdById: userId,
        },
      })

      return updated
    })
  }
}
