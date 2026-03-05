import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { UpdateMyTenantSettingsDto } from './dto/update-my-tenant-settings.dto'
import { UpdateMyAccountSettingsDto } from './dto/update-my-account-settings.dto'
import { ChangeMyPasswordDto } from './dto/change-my-password.dto'

@Controller('my')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'SAAS_USER', 'MANAGER')
export class MyTenantSettingsController {
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

  @Get('tenant-settings')
  async getSettings(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        mode: true,
        dailyRateRub: true,
        minRentalDays: true,
        royaltyPercent: true,
      },
    })
  }

  @Patch('tenant-settings')
  async updateSettings(@Req() req: Request, @CurrentUser() user: JwtUser, @Body() dto: UpdateMyTenantSettingsDto) {
    const tenantId = req.tenantId!

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { mode: true },
    })

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.dailyRateRub !== undefined && { dailyRateRub: dto.dailyRateRub }),
        ...(dto.minRentalDays !== undefined && { minRentalDays: Math.trunc(dto.minRentalDays) }),
        ...(tenant?.mode !== 'SAAS' && dto.royaltyPercent !== undefined && { royaltyPercent: dto.royaltyPercent }),
      },
      select: {
        id: true,
        name: true,
        mode: true,
        dailyRateRub: true,
        minRentalDays: true,
        royaltyPercent: true,
      },
    })

    await this.audit(user.userId, 'SELF_SERVICE_UPDATE_TENANT_SETTINGS', 'TENANT', tenantId, {
      dailyRateRub: updated.dailyRateRub,
      minRentalDays: updated.minRentalDays,
    })

    return updated
  }

  @Get('account-settings')
  async getAccountSettings(@Req() req: Request, @CurrentUser() user: JwtUser) {
    const tenantId = req.tenantId!

    const [tenant, me] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          address: true,
          mode: true,
          saasPlan: true,
          saasSubscriptionStatus: true,
          saasTrialEndsAt: true,
          saasMaxBikes: true,
          saasMaxActiveRentals: true,
          saasPaidUntil: true,
          franchiseeId: true,
          franchisee: {
            select: {
              id: true,
              name: true,
              companyName: true,
              city: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          passwordChangedAt: true,
          lastLoginAt: true,
          lastLoginIp: true,
          lastLoginUserAgent: true,
        },
      }),
    ])

    const planLimits: Record<string, { maxBikes: number; maxActiveRentals: number }> = {
      STARTER: { maxBikes: 15, maxActiveRentals: Number.POSITIVE_INFINITY },
      PRO: { maxBikes: 50, maxActiveRentals: Number.POSITIVE_INFINITY },
      ENTERPRISE: { maxBikes: Number.POSITIVE_INFINITY, maxActiveRentals: Number.POSITIVE_INFINITY },
    }

    let usage: { bikes: number; activeRentals: number } | null = null
    let limits: { maxBikes: number | null; maxActiveRentals: number | null } | null = null

    if (tenant?.mode === 'SAAS') {
      const [bikes, activeRentals] = await Promise.all([
        this.prisma.bike.count({ where: { tenantId, isActive: true } }),
        this.prisma.rental.count({ where: { tenantId, status: 'ACTIVE' } }),
      ])
      usage = { bikes, activeRentals }

      const plan = tenant.saasPlan ?? 'STARTER'
      const base = planLimits[plan] ?? planLimits.STARTER
      limits = {
        maxBikes: tenant.saasMaxBikes ?? (Number.isFinite(base.maxBikes) ? base.maxBikes : null),
        maxActiveRentals:
          tenant.saasMaxActiveRentals ?? (Number.isFinite(base.maxActiveRentals) ? base.maxActiveRentals : null),
      }
    }

    return {
      user: me,
      tenant,
      franchisee: tenant?.franchisee,
      billing: {
        plan: tenant?.saasPlan ?? null,
        status: tenant?.saasSubscriptionStatus ?? null,
        trialEndsAt: tenant?.saasTrialEndsAt ?? null,
        paidUntil: tenant?.saasPaidUntil ?? null,
        limits,
        usage,
      },
    }
  }

  @Patch('account-settings')
  async updateAccountSettings(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateMyAccountSettingsDto,
  ) {
    const tenantId = req.tenantId!

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, franchiseeId: true },
    })
    if (!tenant) throw new BadRequestException('Точка не найдена')

    if (dto.email !== undefined) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
      if (existing && existing.id !== user.userId) {
        throw new BadRequestException('Email уже используется')
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.email !== undefined || dto.fullName !== undefined || dto.phone !== undefined) {
        await tx.user.update({
          where: { id: user.userId },
          data: {
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.fullName !== undefined && { fullName: dto.fullName || null }),
            ...(dto.phone !== undefined && { phone: dto.phone || null }),
          },
        })
      }

      if (dto.companyName !== undefined || dto.city !== undefined) {
        await tx.franchisee.update({
          where: { id: tenant.franchiseeId },
          data: {
            ...(dto.companyName !== undefined && { companyName: dto.companyName || null, name: dto.companyName || undefined }),
            ...(dto.city !== undefined && { city: dto.city || null }),
          },
        })
      }

      if (dto.tenantName !== undefined || dto.address !== undefined) {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: {
            ...(dto.tenantName !== undefined && { name: dto.tenantName }),
            ...(dto.address !== undefined && { address: dto.address || null }),
          },
        })
      }
    })

    await this.audit(user.userId, 'SELF_SERVICE_UPDATE_ACCOUNT_SETTINGS', 'TENANT', tenantId, {
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      companyName: dto.companyName,
      city: dto.city,
      tenantName: dto.tenantName,
      address: dto.address,
    })

    return this.getAccountSettings(req, user)
  }

  @Patch('change-password')
  async changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangeMyPasswordDto) {
    const me = await this.prisma.user.findUnique({ where: { id: user.userId } })
    if (!me) throw new BadRequestException('Пользователь не найден')

    const ok = await bcrypt.compare(dto.currentPassword, me.passwordHash)
    if (!ok) throw new BadRequestException('Текущий пароль неверный')

    const passwordHash = await bcrypt.hash(dto.newPassword, 10)
    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    })

    await this.audit(user.userId, 'SELF_SERVICE_CHANGE_PASSWORD', 'USER', user.userId)
    return { ok: true }
  }

  @Patch('logout-all-sessions')
  async logoutAllSessions(@CurrentUser() user: JwtUser) {
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { tokenVersion: { increment: 1 } },
    })
    await this.audit(user.userId, 'SELF_SERVICE_LOGOUT_ALL_SESSIONS', 'USER', user.userId)
    return { ok: true }
  }

  @Patch('demo/end')
  async endDemoSession(@Req() req: Request, @CurrentUser() user: JwtUser) {
    const tenantId = req.tenantId!

    const me = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, franchiseeId: true },
    })
    if (!me) return { ok: true }

    const isDemoUser = me.email.startsWith('demo+') && me.email.endsWith('@rbcrm.local')
    if (!isDemoUser) return { ok: true }

    await this.prisma.$transaction(async (tx) => {
      await tx.rentalBattery.deleteMany({ where: { tenantId } })
      await tx.payment.deleteMany({ where: { tenantId } })
      await tx.rentalChange.deleteMany({ where: { tenantId } })
      await tx.document.deleteMany({ where: { tenantId } })
      await tx.rental.deleteMany({ where: { tenantId } })
      await tx.expenseBike.deleteMany({ where: { tenantId } })
      await tx.expense.deleteMany({ where: { tenantId } })
      await tx.repair.deleteMany({ where: { tenantId } })
      await tx.battery.deleteMany({ where: { tenantId } })
      await tx.bike.deleteMany({ where: { tenantId } })
      await tx.client.deleteMany({ where: { tenantId } })
      await tx.contractTemplate.deleteMany({ where: { tenantId } })

      await tx.tenant.updateMany({
        where: { id: tenantId },
        data: { isActive: false, name: `DEMO_CLOSED_${tenantId.slice(0, 8)}` },
      })

      await tx.user.update({
        where: { id: me.id },
        data: { isActive: false, tokenVersion: { increment: 1 } },
      })

      if (me.franchiseeId) {
        await tx.franchisee.update({
          where: { id: me.franchiseeId },
          data: { isActive: false },
        })
      }
    })

    await this.audit(user.userId, 'DEMO_AUTO_CLEANUP_ON_SESSION_END', 'TENANT', tenantId)
    return { ok: true }
  }
}
