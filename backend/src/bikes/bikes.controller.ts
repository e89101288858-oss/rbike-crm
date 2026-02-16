import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { BikeStatus } from '@prisma/client'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBikeDto } from './dto/create-bike.dto'
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

  @Get('summary')
  async summary(@Req() req: Request) {
    const tenantId = req.tenantId!

    const [available, rented, maintenance] = await Promise.all([
      this.prisma.bike.count({ where: { tenantId, status: BikeStatus.AVAILABLE } }),
      this.prisma.bike.count({ where: { tenantId, status: BikeStatus.RENTED } }),
      this.prisma.bike.count({ where: { tenantId, status: BikeStatus.MAINTENANCE } }),
    ])

    const revenueTodayRub = rented * 500

    return {
      tenantId,
      available,
      rented,
      maintenance,
      revenueTodayRub,
      currency: 'RUB',
    }
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

  @Patch(':id')
  @Roles('OWNER', 'FRANCHISEE', 'MANAGER', 'MECHANIC')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateBikeDto,
  ) {
    const tenantId = req.tenantId!

    if (user.role === 'MECHANIC' && dto.model !== undefined) {
      throw new ForbiddenException('MECHANIC can change only bike status')
    }

    const bike = await this.prisma.bike.findFirst({
      where: { id, tenantId },
    })
    if (!bike) {
      throw new NotFoundException('Bike not found')
    }
    return this.prisma.bike.update({
      where: { id },
      data: {
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    })
  }
}
