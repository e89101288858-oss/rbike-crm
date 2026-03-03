import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsOptional } from 'class-validator'

export enum SaaSPlanDto {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SaaSSubscriptionStatusDto {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

export class UpdateSaasSubscriptionDto {
  @IsOptional()
  @IsEnum(SaaSPlanDto)
  saasPlan?: SaaSPlanDto

  @IsOptional()
  @IsEnum(SaaSSubscriptionStatusDto)
  saasSubscriptionStatus?: SaaSSubscriptionStatusDto

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saasTrialEndsAt?: Date | null
}
