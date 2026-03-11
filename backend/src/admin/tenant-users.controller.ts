import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { AssignUserToTenantDto } from './dto/assign-user-to-tenant.dto'

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantUsersController {
  constructor(private readonly prisma: PrismaService) {}

  private isSaasAccessExpired(tenant: {
    mode?: 'FRANCHISE' | 'SAAS'
    saasSubscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | null
    saasTrialEndsAt?: Date | null
    saasPaidUntil?: Date | null
  }) {
    if (tenant.mode !== 'SAAS') return false

    const trialExpired =
      tenant.saasSubscriptionStatus === 'TRIAL' &&
      !!tenant.saasTrialEndsAt &&
      tenant.saasTrialEndsAt.getTime() < Date.now()

    const paidExpired =
      tenant.saasSubscriptionStatus === 'ACTIVE' &&
      !!tenant.saasPaidUntil &&
      tenant.saasPaidUntil.getTime() < Date.now()

    const hardBlocked =
      tenant.saasSubscriptionStatus === 'PAST_DUE' ||
      tenant.saasSubscriptionStatus === 'CANCELED'

    return trialExpired || paidExpired || hardBlocked
  }

  private async resolveTenantWithAccess(tenantId: string, currentUser: JwtUser) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, franchiseeId: true, mode: true, saasSubscriptionStatus: true, saasTrialEndsAt: true, saasPaidUntil: true },
    })

    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }

    if (currentUser.role === 'OWNER') {
      // allowed for any existing tenant
    } else if (currentUser.role === 'FRANCHISEE') {
      if (!currentUser.franchiseeId || currentUser.franchiseeId !== tenant.franchiseeId) {
        throw new BadRequestException('Tenant does not belong to current franchisee')
      }
    } else if (currentUser.role === 'SAAS_USER') {
      const allowed = await this.prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: currentUser.userId, tenantId } },
      })
      if (!allowed) throw new BadRequestException('SaaS user can manage only assigned tenant')
    } else {
      throw new BadRequestException('Only OWNER, FRANCHISEE or SAAS_USER can manage tenant users')
    }

    if (currentUser.role !== 'OWNER' && this.isSaasAccessExpired(tenant)) {
      throw new ForbiddenException('Подписка неактивна или истекла. Управление пользователями доступно после продления.')
    }

    return tenant
  }

  @Post(':tenantId/users')
  async assignUserToTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignUserToTenantDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    await this.resolveTenantWithAccess(tenantId, currentUser)

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role !== 'MANAGER' && user.role !== 'MECHANIC' && user.role !== 'SAAS_USER') {
      throw new BadRequestException('Only SAAS_USER, MANAGER or MECHANIC users can be assigned to tenants')
    }

    const existing = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: dto.userId,
          tenantId,
        },
      },
    })

    if (existing) {
      return existing
    }

    return this.prisma.userTenant.create({
      data: {
        userId: dto.userId,
        tenantId,
      },
    })
  }

  @Post(':tenantId/users/create')
  async createTenantUser(
    @Param('tenantId') tenantId: string,
    @Body() dto: { email: string; password: string; fullName?: string; phone?: string; role: 'MANAGER' | 'MECHANIC' },
    @CurrentUser() currentUser: JwtUser,
  ) {
    const tenant = await this.resolveTenantWithAccess(tenantId, currentUser)

    const role = String(dto?.role || '')
    if (role !== 'MANAGER' && role !== 'MECHANIC') {
      throw new BadRequestException('Можно создавать только роли MANAGER или MECHANIC')
    }

    if (!dto?.email || !dto?.password) {
      throw new BadRequestException('Email и пароль обязательны')
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) {
      throw new BadRequestException('Пользователь с таким email уже существует')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim(),
        passwordHash,
        fullName: dto.fullName?.trim() || null,
        phone: dto.phone?.trim() || null,
        role: role as 'MANAGER' | 'MECHANIC',
        franchiseeId: tenant.franchiseeId,
        isActive: true,
      },
      select: { id: true, email: true, role: true, fullName: true, phone: true, isActive: true, createdAt: true },
    })

    await this.prisma.userTenant.create({
      data: { userId: user.id, tenantId },
    })

    return user
  }

  @Patch(':tenantId/users/:userId')
  async updateTenantUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: { role?: 'MANAGER' | 'MECHANIC'; isActive?: boolean; password?: string; fullName?: string; phone?: string },
    @CurrentUser() currentUser: JwtUser,
  ) {
    await this.resolveTenantWithAccess(tenantId, currentUser)

    const relation = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { userId: true },
    })

    if (!relation) throw new NotFoundException('UserTenant not found')

    const patch: any = {}

    if (dto.role !== undefined) {
      if (dto.role !== 'MANAGER' && dto.role !== 'MECHANIC') {
        throw new BadRequestException('Допустимые роли: MANAGER, MECHANIC')
      }
      patch.role = dto.role
    }

    if (dto.isActive !== undefined) patch.isActive = !!dto.isActive
    if (dto.fullName !== undefined) patch.fullName = dto.fullName?.trim() || null
    if (dto.phone !== undefined) patch.phone = dto.phone?.trim() || null

    if (dto.password !== undefined) {
      if (!dto.password || dto.password.length < 6) {
        throw new BadRequestException('Пароль минимум 6 символов')
      }
      patch.passwordHash = await bcrypt.hash(dto.password, 10)
      patch.passwordChangedAt = new Date()
      patch.tokenVersion = { increment: 1 }
    }

    if (!Object.keys(patch).length) {
      throw new BadRequestException('Нет данных для обновления')
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: patch,
      select: { id: true, email: true, role: true, fullName: true, phone: true, isActive: true, createdAt: true },
    })
  }

  @Delete(':tenantId/users/:userId')
  async removeUserFromTenant(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: JwtUser,
  ) {
    await this.resolveTenantWithAccess(tenantId, currentUser)

    const existing = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    })

    if (!existing) {
      throw new NotFoundException('UserTenant not found')
    }

    await this.prisma.userTenant.delete({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    })

    return { userId, tenantId }
  }

  @Get(':tenantId/users')
  async listTenantUsers(
    @Param('tenantId') tenantId: string,
    @CurrentUser() currentUser: JwtUser,
  ) {
    await this.resolveTenantWithAccess(tenantId, currentUser)

    const userTenants = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            fullName: true,
            phone: true,
            franchiseeId: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        user: {
          email: 'asc',
        },
      },
    })

    return userTenants
  }
}
