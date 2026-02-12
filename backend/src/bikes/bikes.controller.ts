import {
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
import { BikeStatus } from '@prisma/client'
import { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBikeDto } from './dto/create-bike.dto'
import { UpdateBikeDto } from './dto/update-bike.dto'

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

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateBikeDto,
  ) {
    const tenantId = req.tenantId!
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
