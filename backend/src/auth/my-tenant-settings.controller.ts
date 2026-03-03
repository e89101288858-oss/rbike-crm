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
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class MyTenantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

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
  async updateSettings(@Req() req: Request, @Body() dto: UpdateMyTenantSettingsDto) {
    const tenantId = req.tenantId!

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { mode: true },
    })

    return this.prisma.tenant.update({
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
        },
      }),
    ])

    return {
      user: me,
      tenant,
      franchisee: tenant?.franchisee,
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

    return { ok: true }
  }

  @Patch('logout-all-sessions')
  async logoutAllSessions(@CurrentUser() user: JwtUser) {
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { tokenVersion: { increment: 1 } },
    })
    return { ok: true }
  }
}
