import { ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export async function assertSaasOperationAllowed(
  prisma: PrismaService,
  tenantId: string,
  operation: 'CREATE_BIKE' | 'CREATE_RENTAL' | 'GENERATE_CONTRACT',
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      mode: true,
      saasPlan: true,
      saasSubscriptionStatus: true,
      saasTrialEndsAt: true,
    },
  })

  if (!tenant) {
    throw new ForbiddenException('Tenant not found')
  }

  if (tenant.mode !== 'SAAS') {
    return
  }

  if (!tenant.saasSubscriptionStatus) {
    throw new ForbiddenException('SaaS subscription is not configured')
  }

  if (tenant.saasSubscriptionStatus === 'PAST_DUE' || tenant.saasSubscriptionStatus === 'CANCELED') {
    throw new ForbiddenException(`Operation ${operation} is blocked: SaaS subscription is ${tenant.saasSubscriptionStatus}`)
  }

  if (
    tenant.saasSubscriptionStatus === 'TRIAL' &&
    tenant.saasTrialEndsAt &&
    tenant.saasTrialEndsAt.getTime() < Date.now()
  ) {
    throw new ForbiddenException(`Operation ${operation} is blocked: SaaS trial expired`)
  }
}
