import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClientDto } from './dto/create-client.dto'
import { ImportClientsDto } from './dto/import-clients.dto'
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
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        address: dto.address ?? undefined,
        passportSeries: dto.passportSeries ?? undefined,
        passportNumber: dto.passportNumber ?? undefined,
        emergencyContactPhone: dto.emergencyContactPhone ?? undefined,
        notes: dto.notes ?? undefined,
      },
    })
  }

  @Post('import')
  async importRows(@Req() req: Request, @Body() dto: ImportClientsDto) {
    const tenantId = req.tenantId!

    const rows = (dto.rows || [])
      .map((r) => ({
        tenantId,
        fullName: r.fullName?.trim(),
        phone: r.phone?.trim() || undefined,
        birthDate: r.birthDate ? new Date(r.birthDate) : undefined,
        address: r.address?.trim() || undefined,
        passportSeries: r.passportSeries?.trim() || undefined,
        passportNumber: r.passportNumber?.trim() || undefined,
        emergencyContactPhone: r.emergencyContactPhone?.trim() || undefined,
        notes: r.notes?.trim() || undefined,
      }))
      .filter((r) => r.fullName)

    if (!rows.length) return { created: 0 }

    const result = await this.prisma.client.createMany({ data: rows })
    return { created: result.count }
  }

  @Get()
  async list(@Req() req: Request, @Query() query: ListClientsQueryDto) {
    const tenantId = req.tenantId!
    const q = query.q?.trim()
    const archivedOnly = query.archivedOnly === 'true'

    return this.prisma.client.findMany({
      where: {
        tenantId,
        isActive: archivedOnly ? false : true,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { passportSeries: { contains: q, mode: 'insensitive' } },
                { passportNumber: { contains: q, mode: 'insensitive' } },
                { emergencyContactPhone: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const activeRental = await this.prisma.rental.findFirst({
      where: { tenantId, clientId: id, status: 'ACTIVE' },
      select: { id: true },
    })

    if (activeRental) {
      throw new NotFoundException('Нельзя архивировать курьера с активной арендой')
    }

    const existing = await this.prisma.client.findFirst({ where: { id, tenantId }, select: { id: true, isActive: true } })
    if (!existing) throw new NotFoundException('Client not found')
    if (!existing.isActive) return { id, deleted: true }

    await this.prisma.client.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    return { id, deleted: true }
  }

  @Post(':id/restore')
  async restore(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    const existing = await this.prisma.client.findFirst({ where: { id, tenantId }, select: { id: true } })
    if (!existing) throw new NotFoundException('Client not found')

    await this.prisma.client.updateMany({ where: { id, tenantId }, data: { isActive: true } })
    return { id, restored: true }
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.client.findFirst({ where: { id, tenantId, isActive: true }, select: { id: true } })
    if (!existing) throw new NotFoundException('Client not found')

    await this.prisma.client.updateMany({
      where: { id, tenantId, isActive: true },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.birthDate !== undefined && { birthDate: dto.birthDate ? new Date(dto.birthDate) : null }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.passportSeries !== undefined && { passportSeries: dto.passportSeries }),
        ...(dto.passportNumber !== undefined && { passportNumber: dto.passportNumber }),
        ...(dto.emergencyContactPhone !== undefined && { emergencyContactPhone: dto.emergencyContactPhone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    })

    return this.prisma.client.findFirst({ where: { id, tenantId, isActive: true } })
  }
}
