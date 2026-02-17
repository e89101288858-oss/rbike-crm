import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFranchiseeDto } from './dto/create-franchisee.dto'
import { UpdateFranchiseeDto } from './dto/update-franchisee.dto'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto } from './dto/update-tenant.dto'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('franchisees')
  async createFranchisee(@Body() dto: CreateFranchiseeDto) {
    return this.prisma.franchisee.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    })
  }

  @Get('franchisees')
  async listFranchisees() {
    return this.prisma.franchisee.findMany({
      include: { tenants: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Get('franchisees/:id')
  async getFranchisee(@Param('id') id: string) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id },
      include: { tenants: true },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return franchisee
  }

  @Delete('franchisees/:id')
  async deleteFranchisee(@Param('id') id: string) {
    const existing = await this.prisma.franchisee.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Franchisee not found')

    const tenantsCount = await this.prisma.tenant.count({ where: { franchiseeId: id } })
    if (tenantsCount > 0) {
      throw new BadRequestException('Нельзя удалить франчайзи: сначала удалите или перенесите все точки')
    }

    await this.prisma.franchisee.delete({ where: { id } })
    return { id, deleted: true }
  }

  @Patch('franchisees/:id')
  async updateFranchisee(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseeDto,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.franchisee.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  @Post('franchisees/:franchiseeId/tenants')
  async createTenant(
    @Param('franchiseeId') franchiseeId: string,
    @Body() dto: CreateTenantDto,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.tenant.create({
      data: {
        franchiseeId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        dailyRateRub: dto.dailyRateRub ?? 500,
        minRentalDays: dto.minRentalDays ?? 7,
      },
    })
  }

  @Get('franchisees/:franchiseeId/tenants')
  async listTenants(@Param('franchiseeId') franchiseeId: string) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.tenant.findMany({
      where: { franchiseeId },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException('Tenant not found')

    const [bikes, clients, rentals, payments, repairs, documents, userTenants] = await Promise.all([
      this.prisma.bike.count({ where: { tenantId: id } }),
      this.prisma.client.count({ where: { tenantId: id } }),
      this.prisma.rental.count({ where: { tenantId: id } }),
      this.prisma.payment.count({ where: { tenantId: id } }),
      this.prisma.repair.count({ where: { tenantId: id } }),
      this.prisma.document.count({ where: { tenantId: id } }),
      this.prisma.userTenant.count({ where: { tenantId: id } }),
    ])

    if (bikes + clients + rentals + payments + repairs + documents + userTenants > 0) {
      throw new BadRequestException('Нельзя удалить точку: есть связанные данные (курьеры/велосипеды/аренды/платежи)')
    }

    await this.prisma.tenant.delete({ where: { id } })
    return { id, deleted: true }
  }

  @Patch('tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    })
    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.dailyRateRub !== undefined && { dailyRateRub: dto.dailyRateRub }),
        ...(dto.minRentalDays !== undefined && { minRentalDays: Math.trunc(dto.minRentalDays) }),
      },
    })
  }
}
