import { IsEmail, IsIn, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator'

export const ALLOWED_ROLES = ['FRANCHISEE', 'MANAGER', 'MECHANIC'] as const

export type AllowedRole = (typeof ALLOWED_ROLES)[number]

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsIn(ALLOWED_ROLES)
  role!: AllowedRole

  @ValidateIf((o: CreateUserDto) => o.role === 'FRANCHISEE')
  @IsString()
  @IsUUID()
  franchiseeId?: string
}
