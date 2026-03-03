import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateMyAccountSettingsDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  @MinLength(2)
  tenantName?: string

  @IsOptional()
  @IsString()
  address?: string
}
