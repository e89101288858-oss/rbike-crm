import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClientDto } from './dto/create-client.dto'
import { ListClientsQueryDto } from './dto/list-clients.query.dto'
import { UpdateClientDto } from './dto/update-client.dto'

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
        address: dto.address ?? undefined,
        passportSeries: dto.passportSeries ?? undefined,
        passportNumber: dto.passportNumber ?? undefined,
        notes: dto.notes ?? undefined,
      },
    })
  }

  @Get()
  async list(@Req() req: Request, @Query() query: ListClientsQueryDto) {
    const tenantId = req.tenantId!
    const q = query.q?.trim()

    return this.prisma.client.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { passportSeries: { contains: q, mode: 'insensitive' } },
                { passportNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.client.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Client not found')

    await this.prisma.client.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.passportSeries !== undefined && { passportSeries: dto.passportSeries }),
        ...(dto.passportNumber !== undefined && { passportNumber: dto.passportNumber }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    })

    return this.prisma.client.findFirst({ where: { id, tenantId } })
  }
}
