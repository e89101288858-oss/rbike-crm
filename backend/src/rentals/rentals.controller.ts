import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common'
import { RentalStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateWeeklyRateDto } from './dto/update-weekly-rate.dto'

@Controller('rentals')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class RentalsController {
  constructor(private readonly prisma: PrismaService) {}

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
