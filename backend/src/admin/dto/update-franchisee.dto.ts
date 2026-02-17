import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateFranchiseeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string

  @IsOptional()
  @IsString()
  companyName?: string

  @IsOptional()
  @IsString()
  signerFullName?: string

  @IsOptional()
  @IsString()
  bankDetails?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
