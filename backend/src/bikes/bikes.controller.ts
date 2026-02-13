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
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBikeDto } from './dto/create-bike.dto'
import { UpdateBikeDto } from './dto/update-bike.dto'
import { UpdateBikeStatusDto } from './dto/update-bike-status.dto'

@Controller('bikes')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BikesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateBikeDto) {
    const tenantId = req.tenantId!
    return this.prisma.bike.create({
      data: {
        tenantId,
        code: dto.code,
        model: dto.model ?? undefined,
        status: (dto.status as BikeStatus) ?? BikeStatus.AVAILABLE,
      },
    })
  }

  @Get()
  async list(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.prisma.bike.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId },
    })
    if (!bike) {
      throw new NotFoundException('Bike not found')
    }
    return bike
  }

  // Update bike basic fields (model only). Status changes must go through /bikes/:id/status
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBikeDto,
  ) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.bike.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) {
      throw new NotFoundException('Bike not found')
    }

    const result = await this.prisma.bike.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.model !== undefined && { model: dto.model }),
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Bike not found')
    }

    return this.prisma.bike.findFirst({
      where: { id, tenantId },
    })
  }

  // Manual status change endpoint (CRITICAL BUSINESS RULE)
  @Patch(':id/status')
  async setStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBikeStatusDto,
  ) {
    const tenantId = req.tenantId!

    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!bike) {
      throw new NotFoundException('Bike not found')
    }

    // If trying to set AVAILABLE, forbid when there is an ACTIVE rental for this bike
    if (dto.status === BikeStatus.AVAILABLE) {
      const activeRental = await this.prisma.rental.findFirst({
        where: {
          tenantId,
          bikeId: id,
          status: RentalStatus.ACTIVE,
        },
        select: { id: true },
      })

      if (activeRental) {
        throw new BadRequestException(
          'Cannot set bike status to AVAILABLE while there is an ACTIVE rental',
        )
      }
    }

    const result = await this.prisma.bike.updateMany({
      where: { id, tenantId },
      data: { status: dto.status },
    })

    if (result.count === 0) {
      throw new NotFoundException('Bike not found')
    }

    return this.prisma.bike.findFirst({
      where: { id, tenantId },
    })
  }
}
