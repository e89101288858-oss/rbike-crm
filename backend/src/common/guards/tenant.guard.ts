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
      select: {
        id: true,
        franchiseeId: true,
        mode: true,
        saasSubscriptionStatus: true,
        saasTrialEndsAt: true,
        saasPaidUntil: true,
      },
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

    let accessGranted = false

    if (user.role === 'OWNER') {
      accessGranted = true
    } else if (user.role === 'FRANCHISEE') {
      accessGranted = user.franchiseeId === tenant.franchiseeId
    } else if (user.role === 'SAAS_USER' || user.role === 'MANAGER' || user.role === 'MECHANIC') {
      const userTenant = await this.prisma.userTenant.findUnique({
        where: {
          userId_tenantId: { userId: user.userId, tenantId },
        },
      })
      accessGranted = !!userTenant
    }

    if (!accessGranted) throw new ForbiddenException('Forbidden')

    if (tenant.mode === 'SAAS') {
      const path: string = String(request.path || request.originalUrl || '')
      const allowedWhenExpired =
        path.startsWith('/my/saas-billing') ||
        path.startsWith('/my/account-settings') ||
        path.startsWith('/my/change-password') ||
        path.startsWith('/my/logout-all-sessions') ||
        path.startsWith('/my/tenant-settings')

      const trialExpired =
        tenant.saasSubscriptionStatus === 'TRIAL' &&
        tenant.saasTrialEndsAt &&
        tenant.saasTrialEndsAt.getTime() < Date.now()

      const paidExpired =
        tenant.saasSubscriptionStatus === 'ACTIVE' &&
        tenant.saasPaidUntil &&
        tenant.saasPaidUntil.getTime() < Date.now()

      const hardBlocked = tenant.saasSubscriptionStatus === 'PAST_DUE' || tenant.saasSubscriptionStatus === 'CANCELED'

      if (!allowedWhenExpired && (trialExpired || paidExpired || hardBlocked)) {
        throw new ForbiddenException('Подписка истекла или неактивна. Продлите подписку в разделе «Биллинг и оплата».')
      }
    }

    request.tenantId = tenantId
    return true
  }
}
