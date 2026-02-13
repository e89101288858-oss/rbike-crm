import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { BikeStatus, RentalStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRentalDto } from './dto/create-rental.dto'

@Injectable()
export class RentalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateRentalDto) {
    const startDate = new Date(dto.startDate)
    const plannedEndDate = new Date(dto.plannedEndDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(plannedEndDate.getTime())) {
      throw new BadRequestException('Invalid dates')
    }

    const msPerDay = 1000 * 60 * 60 * 24
    const diffDays = (plannedEndDate.getTime() - startDate.getTime()) / msPerDay

    if (diffDays < 7) {
      throw new BadRequestException('Minimum rental duration is 7 days')
    }

    const bike = await this.prisma.bike.findFirst({
      where: {
        id: dto.bikeId,
        tenantId,
      },
    })

    if (!bike) {
      throw new BadRequestException('Bike not found for current tenant')
    }

    if (bike.status !== BikeStatus.AVAILABLE) {
      throw new BadRequestException('Bike is not available')
    }

    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        tenantId,
      },
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

  async close(tenantId: string, id: string) {
    const existing = await this.prisma.rental.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    })

    if (!existing) {
      throw new NotFoundException('Rental not found')
    }

    if (existing.status !== RentalStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE rental can be closed')
    }

    const result = await this.prisma.rental.updateMany({
      where: { id, tenantId, status: RentalStatus.ACTIVE },
      data: {
        status: RentalStatus.CLOSED,
        actualEndDate: new Date(),
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Rental not found')
    }

    const updated = await this.prisma.rental.findFirst({
      where: { id, tenantId },
    })

    if (!updated) {
      throw new NotFoundException('Rental not found')
    }

    return updated
  }
}
