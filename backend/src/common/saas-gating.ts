import { ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type SaasOperation = 'CREATE_BIKE' | 'CREATE_RENTAL' | 'GENERATE_CONTRACT'

const SAAS_PLAN_LIMITS: Record<string, { maxBikes: number; maxActiveRentals: number }> = {
  STARTER: {
    maxBikes: 25,
    maxActiveRentals: 20,
  },
  PRO: {
    maxBikes: 120,
    maxActiveRentals: 100,
  },
  ENTERPRISE: {
    maxBikes: Number.POSITIVE_INFINITY,
    maxActiveRentals: Number.POSITIVE_INFINITY,
  },
}

export async function assertSaasOperationAllowed(
  prisma: PrismaService,
  tenantId: string,
  operation: SaasOperation,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      mode: true,
      saasPlan: true,
      saasSubscriptionStatus: true,
      saasTrialEndsAt: true,
      saasMaxBikes: true,
      saasMaxActiveRentals: true,
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

  const plan = tenant.saasPlan ?? 'STARTER'
  const limits = SAAS_PLAN_LIMITS[plan] ?? SAAS_PLAN_LIMITS.STARTER
  const maxBikes = tenant.saasMaxBikes ?? limits.maxBikes
  const maxActiveRentals = tenant.saasMaxActiveRentals ?? limits.maxActiveRentals

  if (operation === 'CREATE_BIKE' && Number.isFinite(maxBikes)) {
    const bikesCount = await prisma.bike.count({
      where: {
        tenantId,
        isActive: true,
      },
    })

    if (bikesCount >= maxBikes) {
      throw new ForbiddenException(
        `Bike limit reached for ${plan}: ${maxBikes}. Contact owner or upgrade plan to add more bikes.`,
      )
    }
  }

  if (operation === 'CREATE_RENTAL' && Number.isFinite(maxActiveRentals)) {
    const activeRentalsCount = await prisma.rental.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    })

    if (activeRentalsCount >= maxActiveRentals) {
      throw new ForbiddenException(
        `Active rentals limit reached for ${plan}: ${maxActiveRentals}. Contact owner or upgrade plan to create more rentals.`,
      )
    }
  }
}
