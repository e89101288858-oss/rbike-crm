import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const tenantId = request.headers['x-tenant-id'] as string | undefined

    if (!tenantId) {
      throw new BadRequestException('Missing X-Tenant-Id header')
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, franchiseeId: true },
    })

    if (!tenant) {
      throw new BadRequestException('Invalid tenant id')
    }

    const user = request.user as
      | { userId: string; role: string; franchiseeId: string | null }
      | undefined
    if (!user) {
      throw new ForbiddenException('Forbidden')
    }

    if (user.role === 'OWNER') {
      request.tenantId = tenantId
      return true
    }

    if (user.role === 'FRANCHISEE') {
      if (user.franchiseeId === tenant.franchiseeId) {
        request.tenantId = tenantId
        return true
      }
      throw new ForbiddenException('Forbidden')
    }

    if (user.role === 'MANAGER' || user.role === 'MECHANIC') {
      const userTenant = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: { userId: user.userId, tenantId },
        },
      })
      if (userTenant) {
        request.tenantId = tenantId
        return true
      }
      throw new ForbiddenException('Forbidden')
    }

    throw new ForbiddenException('Forbidden')
  }
}
