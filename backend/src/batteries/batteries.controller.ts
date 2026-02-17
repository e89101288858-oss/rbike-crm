import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { BatteryStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBatteryDto } from './dto/create-battery.dto'
import { ListBatteriesQueryDto } from './dto/list-batteries.query.dto'
import { UpdateBatteryDto } from './dto/update-battery.dto'

@Controller('batteries')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC')
export class BatteriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC')
  async create(@Req() req: Request, @Body() dto: CreateBatteryDto) {
    const tenantId = req.tenantId!

    if (dto.bikeId) {
      const bike = await this.prisma.bike.findFirst({ where: { id: dto.bikeId, tenantId, isActive: true }, select: { id: true } })
      if (!bike) throw new NotFoundException('Bike not found')
    }

    return this.prisma.battery.create({
      data: {
        tenantId,
        code: dto.code,
        serialNumber: dto.serialNumber ?? undefined,
        bikeId: dto.bikeId ?? undefined,
        status: (dto.status as BatteryStatus) ?? BatteryStatus.AVAILABLE,
        notes: dto.notes ?? undefined,
      },
    })
  }

  @Get()
  async list(@Req() req: Request, @Query() query: ListBatteriesQueryDto) {
    const tenantId = req.tenantId!
    const archivedOnly = query.archivedOnly === 'true'
    const q = query.q?.trim()

    return this.prisma.battery.findMany({
      where: {
        tenantId,
        isActive: archivedOnly ? false : true,
        ...(query.bikeId ? { bikeId: query.bikeId } : {}),
        ...(q ? { OR: [{ code: { contains: q, mode: 'insensitive' } }, { serialNumber: { contains: q, mode: 'insensitive' } }] } : {}),
      },
      include: { bike: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBatteryDto) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.battery.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } })
    if (!existing) throw new NotFoundException('Battery not found')

    let bikeId: string | null | undefined = undefined
    if (dto.clearBike) bikeId = null
    else if (dto.bikeId !== undefined) {
      const bike = await this.prisma.bike.findFirst({ where: { id: dto.bikeId, tenantId, isActive: true }, select: { id: true } })
      if (!bike) throw new NotFoundException('Bike not found')
      bikeId = dto.bikeId
    }

    await this.prisma.battery.updateMany({
      where: { id, tenantId, isActive: true },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber || null }),
        ...(bikeId !== undefined && { bikeId }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes || null }),
      },
    })

    return this.prisma.battery.findFirst({ where: { id, tenantId } })
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.battery.findFirst({ where: { id, tenantId }, select: { id: true, isActive: true } })
    if (!existing) throw new NotFoundException('Battery not found')
    if (!existing.isActive) return { id, deleted: true }

    await this.prisma.battery.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    return { id, deleted: true }
  }

  @Post(':id/restore')
  async restore(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    const existing = await this.prisma.battery.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Battery not found')

    await this.prisma.battery.updateMany({ where: { id, tenantId }, data: { isActive: true } })
    return { id, restored: true }
  }
}
