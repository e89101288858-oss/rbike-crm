import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
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

  @Post(':tenantId/users')
  async assignUserToTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignUserToTenantDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
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

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role !== 'MANAGER' && user.role !== 'MECHANIC' && user.role !== 'SAAS_USER') {
      throw new BadRequestException(
        'Only SAAS_USER, MANAGER or MECHANIC users can be assigned to tenants',
      )
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

  @Delete(':tenantId/users/:userId')
  async removeUserFromTenant(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: JwtUser,
  ) {
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
      if (!allowed) throw new BadRequestException('SaaS user can view only assigned tenant')
    } else {
      throw new BadRequestException('Only OWNER, FRANCHISEE or SAAS_USER can view tenant users')
    }

    if (currentUser.role !== 'OWNER' && this.isSaasAccessExpired(tenant)) {
      throw new ForbiddenException('Подписка неактивна или истекла. Управление пользователями доступно после продления.')
    }

    const userTenants = await this.prisma.userTenant.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
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

