import { IsOptional, IsUUID } from 'class-validator'

export class ApproveRegistrationDto {
  @IsUUID()
  franchiseeId!: string

  @IsOptional()
  @IsUUID()
  tenantId?: string
}
