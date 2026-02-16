import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClientDto } from './dto/create-client.dto'

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateClientDto) {
    const tenantId = req.tenantId!

    return this.prisma.client.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone ?? undefined,
        notes: dto.notes ?? undefined,
      },
    })
  }

  @Get()
  async list(@Req() req: Request) {
    const tenantId = req.tenantId!

    return this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
