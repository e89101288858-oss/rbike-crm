import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator'

const ALLOWED_ROLES = ['FRANCHISEE', 'MANAGER', 'MECHANIC'] as const

export class CreateUserDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsIn(ALLOWED_ROLES)
  role!: (typeof ALLOWED_ROLES)[number]

  @ValidateIf((o: CreateUserDto) => o.role === 'FRANCHISEE')
  @IsString()
  @IsUUID()
  franchiseeId?: string

  @ValidateIf((o: CreateUserDto) => o.role === 'MANAGER' || o.role === 'MECHANIC')
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  tenantIds?: string[]
}
