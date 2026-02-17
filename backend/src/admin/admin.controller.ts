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
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { ApproveRegistrationDto } from './dto/approve-registration.dto'
import { CreateFranchiseeDto } from './dto/create-franchisee.dto'
import { UpdateFranchiseeDto } from './dto/update-franchisee.dto'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto } from './dto/update-tenant.dto'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  private async audit(userId: string | undefined, action: string, targetType: string, targetId?: string, details?: any) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        details: details ?? undefined,
      },
    })
  }

  @Post('franchisees')
  async createFranchisee(@Body() dto: CreateFranchiseeDto, @CurrentUser() user: JwtUser) {
    const created = await this.prisma.franchisee.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    })
    await this.audit(user.userId, 'CREATE_FRANCHISEE', 'FRANCHISEE', created.id, { name: created.name })
    return created
  }

  @Get('admin/registration-requests')
  async listRegistrationRequests() {
    return this.prisma.registrationRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { reviewedBy: { select: { id: true, email: true, role: true } } },
    })
  }

  @Post('admin/registration-requests/:id/approve')
  async approveRegistration(
    @Param('id') id: string,
    @Body() dto: ApproveRegistrationDto,
    @CurrentUser() user: JwtUser,
  ) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { id } })
    if (!req) throw new NotFoundException('Registration request not found')
    if (req.status !== 'PENDING') throw new BadRequestException('Request already processed')

    const franchisee = await this.prisma.franchisee.findUnique({ where: { id: dto.franchiseeId }, select: { id: true } })
    if (!franchisee) throw new BadRequestException('Franchisee not found')

    if (dto.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId }, select: { id: true, franchiseeId: true } })
      if (!tenant) throw new BadRequestException('Tenant not found')
      if (tenant.franchiseeId !== dto.franchiseeId) throw new BadRequestException('Tenant does not belong to selected franchisee')
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: req.email } })
    if (existingUser) throw new BadRequestException('User already exists')

    const created = await this.prisma.$transaction(async (tx) => {
      const userCreated = await tx.user.create({
        data: {
          email: req.email,
          passwordHash: req.passwordHash,
          role: 'FRANCHISEE',
          franchiseeId: dto.franchiseeId,
          isActive: true,
        },
      })

      if (dto.tenantId) {
        await tx.userTenant.create({ data: { userId: userCreated.id, tenantId: dto.tenantId } })
      }

      await tx.registrationRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: user.userId, reviewedAt: new Date() },
      })

      return userCreated
    })

    await this.audit(user.userId, 'APPROVE_REGISTRATION', 'REGISTRATION_REQUEST', id, {
      email: req.email,
      franchiseeId: dto.franchiseeId,
      tenantId: dto.tenantId ?? null,
      createdUserId: created.id,
    })

    return { id, approved: true, userId: created.id }
  }

  @Post('admin/registration-requests/:id/reject')
  async rejectRegistration(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const req = await this.prisma.registrationRequest.findUnique({ where: { id } })
    if (!req) throw new NotFoundException('Registration request not found')
    if (req.status !== 'PENDING') throw new BadRequestException('Request already processed')

    await this.prisma.registrationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: user.userId, reviewedAt: new Date() },
    })

    await this.audit(user.userId, 'REJECT_REGISTRATION', 'REGISTRATION_REQUEST', id, { email: req.email })
    return { id, rejected: true }
  }

  @Get('admin/audit')
  async listAudit() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, role: true } },
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
  async deleteFranchisee(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const existing = await this.prisma.franchisee.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('Franchisee not found')

    const tenantsCount = await this.prisma.tenant.count({ where: { franchiseeId: id } })
    if (tenantsCount > 0) {
      throw new BadRequestException('Нельзя удалить франчайзи: сначала удалите или перенесите все точки')
    }

    await this.prisma.franchisee.delete({ where: { id } })
    await this.audit(user.userId, 'DELETE_FRANCHISEE', 'FRANCHISEE', id, { name: existing.name })
    return { id, deleted: true }
  }

  @Patch('franchisees/:id')
  async updateFranchisee(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseeDto,
    @CurrentUser() user: JwtUser,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    const updated = await this.prisma.franchisee.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
    await this.audit(user.userId, 'UPDATE_FRANCHISEE', 'FRANCHISEE', id, {
      from: { name: franchisee.name, isActive: franchisee.isActive },
      to: { name: updated.name, isActive: updated.isActive },
    })
    return updated
  }

  @Post('franchisees/:franchiseeId/tenants')
  async createTenant(
    @Param('franchiseeId') franchiseeId: string,
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: JwtUser,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    const created = await this.prisma.tenant.create({
      data: {
        franchiseeId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        dailyRateRub: dto.dailyRateRub ?? 500,
        minRentalDays: dto.minRentalDays ?? 7,
      },
    })
    await this.audit(user.userId, 'CREATE_TENANT', 'TENANT', created.id, {
      name: created.name,
      franchiseeId,
      dailyRateRub: created.dailyRateRub,
      minRentalDays: created.minRentalDays,
    })
    return created
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
  async deleteTenant(@Param('id') id: string, @CurrentUser() user: JwtUser) {
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
    await this.audit(user.userId, 'DELETE_TENANT', 'TENANT', id, { name: tenant.name })
    return { id, deleted: true }
  }

  @Patch('tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto, @CurrentUser() user: JwtUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    })
    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }
    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.dailyRateRub !== undefined && { dailyRateRub: dto.dailyRateRub }),
        ...(dto.minRentalDays !== undefined && { minRentalDays: Math.trunc(dto.minRentalDays) }),
      },
    })
    await this.audit(user.userId, 'UPDATE_TENANT', 'TENANT', id, {
      from: {
        name: tenant.name,
        isActive: tenant.isActive,
        dailyRateRub: tenant.dailyRateRub,
        minRentalDays: tenant.minRentalDays,
      },
      to: {
        name: updated.name,
        isActive: updated.isActive,
        dailyRateRub: updated.dailyRateRub,
        minRentalDays: updated.minRentalDays,
      },
    })
    return updated
  }
}
