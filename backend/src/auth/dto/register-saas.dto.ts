import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterSaasDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(6)
  password!: string

  @IsString()
  @MinLength(2)
  fullName!: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsString()
  @MinLength(2)
  companyName!: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  tenantName?: string
}
