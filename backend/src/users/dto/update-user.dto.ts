import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { ALLOWED_ROLES, AllowedRole } from './create-user.dto'

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ALLOWED_ROLES)
  role?: AllowedRole

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string

  @ValidateIf((o: UpdateUserDto) => o.role === 'FRANCHISEE')
  @IsOptional()
  @IsString()
  @IsUUID()
  franchiseeId?: string
}

