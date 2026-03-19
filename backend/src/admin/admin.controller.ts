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
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { EmailService } from '../notifications/email.service'
import { ApproveRegistrationDto } from './dto/approve-registration.dto'
import { CreateFranchiseeDto } from './dto/create-franchisee.dto'
import { UpdateFranchiseeDto } from './dto/update-franchisee.dto'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto } from './dto/update-tenant.dto'
import { UpdateSaasSubscriptionDto } from './dto/update-saas-subscription.dto'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

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
        companyName: dto.companyName ?? null,
        signerFullName: dto.signerFullName ?? null,
        bankDetails: dto.bankDetails ?? null,
        city: dto.city ?? null,
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

  @Get('admin/system/overview')
  async systemOverview() {
    const now = Date.now()
    let dbOk = true
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      dbOk = false
    }

    const [franchisees, tenantsTotal, tenantsSaas, usersTotal, invoicesPending, invoicesFailed, invoicesPaid] = await Promise.all([
      this.prisma.franchisee.count(),
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { mode: 'SAAS' } }),
      this.prisma.user.count(),
      this.prisma.saaSInvoice.count({ where: { status: 'PENDING' } }),
      this.prisma.saaSInvoice.count({ where: { status: 'FAILED' } }),
      this.prisma.saaSInvoice.count({ where: { status: 'PAID' } }),
    ])

    return {
      serverTime: new Date(now).toISOString(),
      uptimeSec: Math.round(process.uptime()),
      version: process.env.npm_package_version || 'unknown',
      env: process.env.NODE_ENV || 'development',
      health: {
        api: true,
        db: dbOk,
      },
      process: {
        pid: process.pid,
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      counts: {
        franchisees,
        tenantsTotal,
        tenantsSaas,
        usersTotal,
      },
      billing: {
        pending: invoicesPending,
        failed: invoicesFailed,
        paid: invoicesPaid,
      },
      emailEnabled: !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    }
  }

  @Get('admin/tenants')
  async listTenantsGlobal(
    @Query('q') q?: string,
    @Query('mode') mode?: 'FRANCHISE' | 'SAAS',
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = Math.max(1, Number(page || 1))
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize || 20)))

    const where = {
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      ...(mode ? { mode } : {}),
      ...(isActive === 'true' ? { isActive: true } : {}),
      ...(isActive === 'false' ? { isActive: false } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        include: {
          franchisee: { select: { id: true, name: true } },
          _count: { select: { userTenants: true, bikes: true, clients: true, rentals: true } },
        },
      }),
    ])

    return {
      items,
      page: pageNum,
      pageSize: sizeNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / sizeNum)),
    }
  }

  @Get('admin/saas/invoices')
  async listSaasInvoices(@Query('limit') limit?: string) {
    const take = Math.max(1, Math.min(200, Number(limit || 50)))
    return this.prisma.saaSInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        tenant: { select: { id: true, name: true, mode: true } },
      },
    })
  }

  @Post('admin/system/test-email')
  async sendTestEmail(@Body() dto: { to: string }) {
    if (!dto?.to) throw new BadRequestException('to is required')

    const result = await this.email.send(
      dto.to,
      'Тестовое письмо rbCRM',
      '<div style="font-family:Arial,sans-serif"><h3>rbCRM test</h3><p>SMTP настроен корректно.</p></div>',
      'rbCRM test: SMTP настроен корректно.',
    )

    if (!result.ok) {
      throw new BadRequestException('Не удалось отправить тестовое письмо')
    }

    return { ok: true }
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
        ...(dto.companyName !== undefined && { companyName: dto.companyName }),
        ...(dto.signerFullName !== undefined && { signerFullName: dto.signerFullName }),
        ...(dto.bankDetails !== undefined && { bankDetails: dto.bankDetails }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
    await this.audit(user.userId, 'UPDATE_FRANCHISEE', 'FRANCHISEE', id, {
      from: {
        name: franchisee.name,
        companyName: franchisee.companyName,
        signerFullName: franchisee.signerFullName,
        bankDetails: franchisee.bankDetails,
        city: franchisee.city,
        isActive: franchisee.isActive,
      },
      to: {
        name: updated.name,
        companyName: updated.companyName,
        signerFullName: updated.signerFullName,
        bankDetails: updated.bankDetails,
        city: updated.city,
        isActive: updated.isActive,
      },
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
    const tenantMode = dto.mode ?? 'FRANCHISE'
    const created = await this.prisma.tenant.create({
      data: {
        franchiseeId,
        name: dto.name,
        address: dto.address ?? null,
        isActive: dto.isActive ?? true,
        dailyRateRub: dto.dailyRateRub ?? 500,
        minRentalDays: dto.minRentalDays ?? 7,
        royaltyPercent: dto.royaltyPercent ?? 5,
        mode: tenantMode,
        ...(tenantMode === 'SAAS' && {
          saasPlan: 'STARTER',
          saasSubscriptionStatus: 'TRIAL',
          saasTrialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        }),
      },
    })
    await this.audit(user.userId, 'CREATE_TENANT', 'TENANT', created.id, {
      name: created.name,
      franchiseeId,
      mode: created.mode,
      saasPlan: created.saasPlan,
      saasSubscriptionStatus: created.saasSubscriptionStatus,
      dailyRateRub: created.dailyRateRub,
      minRentalDays: created.minRentalDays,
      royaltyPercent: created.royaltyPercent,
    })
    return created
  }

  @Get('franchisees/:franchiseeId/tenants')
  async listTenants(
    @Param('franchiseeId') franchiseeId: string,
    @Query('mode') mode?: 'FRANCHISE' | 'SAAS',
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.tenant.findMany({
      where: {
        franchiseeId,
        ...(mode ? { mode } : {}),
        isActive: true,
        name: { not: { startsWith: 'DEMO_CLOSED_' } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Get('admin/saas/tenants')
  async listSaasTenants() {
    return this.prisma.tenant.findMany({
      where: {
        mode: 'SAAS',
        isActive: true,
        name: { not: { startsWith: 'DEMO_CLOSED_' } },
        franchisee: {
          isActive: true,
          name: { not: { startsWith: 'Demo ' } },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        franchisee: {
          select: { id: true, name: true, companyName: true, city: true },
        },
      },
    })
  }

  @Get('admin/saas/summary')
  async getSaasSummary() {
    const now = new Date()
    const trialExpiringBefore = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const saasBaseWhere = {
      mode: 'SAAS' as const,
      isActive: true,
      name: { not: { startsWith: 'DEMO_CLOSED_' } },
      franchisee: {
        isActive: true,
        name: { not: { startsWith: 'Demo ' } },
      },
    }

    const [
      totalSaasTenants,
      trialCount,
      activeCount,
      pastDueCount,
      canceledCount,
      starterCount,
      proCount,
      enterpriseCount,
      trialExpiringSoon,
    ] = await Promise.all([
      this.prisma.tenant.count({ where: saasBaseWhere }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasSubscriptionStatus: 'TRIAL' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasSubscriptionStatus: 'ACTIVE' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasSubscriptionStatus: 'PAST_DUE' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasSubscriptionStatus: 'CANCELED' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasPlan: 'STARTER' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasPlan: 'PRO' } }),
      this.prisma.tenant.count({ where: { ...saasBaseWhere, saasPlan: 'ENTERPRISE' } }),
      this.prisma.tenant.count({
        where: {
          ...saasBaseWhere,
          saasSubscriptionStatus: 'TRIAL',
          saasTrialEndsAt: {
            gte: now,
            lte: trialExpiringBefore,
          },
        },
      }),
    ])

    return {
      totalSaasTenants,
      subscriptions: {
        trial: trialCount,
        active: activeCount,
        pastDue: pastDueCount,
        canceled: canceledCount,
      },
      plans: {
        starter: starterCount,
        pro: proCount,
        enterprise: enterpriseCount,
      },
      trialExpiringSoon,
    }
  }

  @Patch('admin/saas/tenants/:id/subscription')
  async updateSaasSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateSaasSubscriptionDto,
    @CurrentUser() user: JwtUser,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException('Tenant not found')
    if (tenant.mode !== 'SAAS') {
      throw new BadRequestException('Точка не в режиме подписки')
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.saasPlan !== undefined && { saasPlan: dto.saasPlan }),
        ...(dto.saasSubscriptionStatus !== undefined && {
          saasSubscriptionStatus: dto.saasSubscriptionStatus,
        }),
        ...(dto.saasTrialEndsAt !== undefined && {
          saasTrialEndsAt: dto.saasTrialEndsAt,
        }),
        ...(dto.saasMaxBikes !== undefined && {
          saasMaxBikes: dto.saasMaxBikes,
        }),
        ...(dto.saasMaxActiveRentals !== undefined && {
          saasMaxActiveRentals: dto.saasMaxActiveRentals,
        }),
      },
    })

    await this.audit(user.userId, 'UPDATE_SAAS_SUBSCRIPTION', 'TENANT', id, {
      from: {
        saasPlan: tenant.saasPlan,
        saasSubscriptionStatus: tenant.saasSubscriptionStatus,
        saasTrialEndsAt: tenant.saasTrialEndsAt,
        saasMaxBikes: tenant.saasMaxBikes,
        saasMaxActiveRentals: tenant.saasMaxActiveRentals,
      },
      to: {
        saasPlan: updated.saasPlan,
        saasSubscriptionStatus: updated.saasSubscriptionStatus,
        saasTrialEndsAt: updated.saasTrialEndsAt,
        saasMaxBikes: updated.saasMaxBikes,
        saasMaxActiveRentals: updated.saasMaxActiveRentals,
      },
    })

    return updated
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
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.dailyRateRub !== undefined && { dailyRateRub: dto.dailyRateRub }),
        ...(dto.minRentalDays !== undefined && { minRentalDays: Math.trunc(dto.minRentalDays) }),
        ...(dto.royaltyPercent !== undefined && { royaltyPercent: dto.royaltyPercent }),
        ...(dto.mode !== undefined && { mode: dto.mode }),
      },
    })
    await this.audit(user.userId, 'UPDATE_TENANT', 'TENANT', id, {
      from: {
        name: tenant.name,
        address: tenant.address,
        isActive: tenant.isActive,
        dailyRateRub: tenant.dailyRateRub,
        minRentalDays: tenant.minRentalDays,
        royaltyPercent: tenant.royaltyPercent,
        mode: tenant.mode,
      },
      to: {
        name: updated.name,
        address: updated.address,
        isActive: updated.isActive,
        dailyRateRub: updated.dailyRateRub,
        minRentalDays: updated.minRentalDays,
        royaltyPercent: updated.royaltyPercent,
        mode: updated.mode,
      },
    })
    return updated
  }
}
