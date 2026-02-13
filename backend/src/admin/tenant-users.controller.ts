import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { AssignUserToTenantDto } from './dto/assign-user-to-tenant.dto'

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'FRANCHISEE')
export class TenantUsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':tenantId/users')
  async assignUserToTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignUserToTenantDto,
    @CurrentUser() currentUser: JwtUser,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, franchiseeId: true },
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
    } else {
      throw new BadRequestException('Only OWNER or FRANCHISEE can manage tenant users')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role !== 'MANAGER' && user.role !== 'MECHANIC') {
      throw new BadRequestException(
        'Only MANAGER or MECHANIC users can be assigned to tenants',
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
      select: { id: true, franchiseeId: true },
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
    } else {
      throw new BadRequestException('Only OWNER or FRANCHISEE can manage tenant users')
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
      select: { id: true, franchiseeId: true },
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
    } else {
      throw new BadRequestException('Only OWNER or FRANCHISEE can view tenant users')
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

