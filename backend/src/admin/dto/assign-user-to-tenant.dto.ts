import { IsString, IsUUID } from 'class-validator'

export class AssignUserToTenantDto {
  @IsString()
  @IsUUID()
  userId!: string
}

