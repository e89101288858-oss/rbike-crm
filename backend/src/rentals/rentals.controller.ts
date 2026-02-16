import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { BikeStatus, RentalStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRentalDto } from './dto/create-rental.dto'
import { UpdateWeeklyRateDto } from './dto/update-weekly-rate.dto'

@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class RentalsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateRentalDto) {
    const tenantId = req.tenantId!

    const startDate = new Date(dto.startDate)
    const plannedEndDate = new Date(dto.plannedEndDate)

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(plannedEndDate.getTime())) {
      throw new BadRequestException('Invalid dates')
    }

    const diffDays = Math.ceil((plannedEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
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
      select: { id: true },
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
          weeklyRateRub: dto.weeklyRateRub ?? 0,
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

  @Get('active')
  async active(@Req() req: Request) {
    const tenantId = req.tenantId!

    return this.prisma.rental.findMany({
      where: {
        tenantId,
        status: RentalStatus.ACTIVE,
      },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        startDate: true,
        plannedEndDate: true,
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
      },
    })
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
