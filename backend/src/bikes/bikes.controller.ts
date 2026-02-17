import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { BikeStatus, PaymentStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBikeDto } from './dto/create-bike.dto'
import { ImportBikesDto } from './dto/import-bikes.dto'
import { ListBikesQueryDto } from './dto/list-bikes.query.dto'
import { UpdateBikeDto } from './dto/update-bike.dto'

@Controller('bikes')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC')
export class BikesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER')
  async create(@Req() req: Request, @Body() dto: CreateBikeDto) {
    const tenantId = req.tenantId!
    return this.prisma.bike.create({
      data: {
        tenantId,
        code: dto.code,
        model: dto.model ?? undefined,
        frameNumber: dto.frameNumber ?? undefined,
        motorWheelNumber: dto.motorWheelNumber ?? undefined,
        simCardNumber: dto.simCardNumber ?? undefined,
        status: (dto.status as BikeStatus) ?? BikeStatus.AVAILABLE,
        repairReason: dto.repairReason ?? undefined,
        repairEndDate: dto.repairEndDate ? new Date(dto.repairEndDate) : undefined,
      },
    })
  }

  @Get()
  async list(@Req() req: Request, @Query() query: ListBikesQueryDto) {
    const tenantId = req.tenantId!
    const archivedOnly = query.archivedOnly === 'true'
    return this.prisma.bike.findMany({
      where: { tenantId, isActive: archivedOnly ? false : true },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Post('import')
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER')
  async importRows(@Req() req: Request, @Body() dto: ImportBikesDto) {
    const tenantId = req.tenantId!

    const rows = (dto.rows || [])
      .map((r) => ({
        tenantId,
        code: r.code?.trim(),
        model: r.model?.trim() || undefined,
        frameNumber: r.frameNumber?.trim() || undefined,
        motorWheelNumber: r.motorWheelNumber?.trim() || undefined,
        simCardNumber: r.simCardNumber?.trim() || undefined,
        status: (r.status as BikeStatus) ?? BikeStatus.AVAILABLE,
        repairReason: undefined,
        repairEndDate: undefined,
      }))
      .filter((r) => r.code)

    if (!rows.length) return { created: 0 }

    const result = await this.prisma.bike.createMany({ data: rows, skipDuplicates: true })
    return { created: result.count }
  }

  @Get('summary')
  async summary(@Req() req: Request) {
    const tenantId = req.tenantId!

    const now = new Date()
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))

    const [available, rented, maintenance, todayAgg, monthAgg] = await Promise.all([
      this.prisma.bike.count({ where: { tenantId, isActive: true, status: BikeStatus.AVAILABLE } }),
      this.prisma.bike.count({ where: { tenantId, isActive: true, status: BikeStatus.RENTED } }),
      this.prisma.bike.count({ where: { tenantId, isActive: true, status: BikeStatus.MAINTENANCE } }),
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfToday, lt: startOfTomorrow },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfMonth, lt: startOfTomorrow },
        },
        _sum: { amount: true },
      }),
    ])

    const revenueTodayRub = Math.round((todayAgg._sum.amount ?? 0) * 100) / 100
    const revenueMonthRub = Math.round((monthAgg._sum.amount ?? 0) * 100) / 100

    return {
      tenantId,
      available,
      rented,
      maintenance,
      revenueTodayRub,
      revenueMonthRub,
      currency: 'RUB',
    }
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId, isActive: true },
    })
    if (!bike) {
      throw new NotFoundException('Bike not found')
    }
    return bike
  }

  @Delete(':id')
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true, isActive: true },
    })

    if (!bike) throw new NotFoundException('Bike not found')
    if (!bike.isActive) return { id, deleted: true }
    if (bike.status === BikeStatus.RENTED) {
      throw new ForbiddenException('Нельзя архивировать велосипед со статусом RENTED')
    }

    await this.prisma.bike.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    return { id, deleted: true }
  }

  @Post(':id/restore')
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER')
  async restore(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    const existing = await this.prisma.bike.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Bike not found')

    await this.prisma.bike.updateMany({ where: { id, tenantId }, data: { isActive: true } })
    return { id, restored: true }
  }

  @Patch(':id')
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateBikeDto,
  ) {
    const tenantId = req.tenantId!

    if (
      user.role === 'MECHANIC' &&
      (dto.model !== undefined ||
        dto.code !== undefined ||
        dto.frameNumber !== undefined ||
        dto.motorWheelNumber !== undefined ||
        dto.simCardNumber !== undefined)
    ) {
      throw new ForbiddenException('MECHANIC can change only bike status')
    }

    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId, isActive: true },
    })
    if (!bike) {
      throw new NotFoundException('Bike not found')
    }
    return this.prisma.bike.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.frameNumber !== undefined && { frameNumber: dto.frameNumber }),
        ...(dto.motorWheelNumber !== undefined && { motorWheelNumber: dto.motorWheelNumber }),
        ...(dto.simCardNumber !== undefined && { simCardNumber: dto.simCardNumber }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.repairReason !== undefined && { repairReason: dto.repairReason || null }),
        ...(dto.repairEndDate !== undefined && { repairEndDate: dto.repairEndDate ? new Date(dto.repairEndDate) : null }),
      },
    })
  }
}
