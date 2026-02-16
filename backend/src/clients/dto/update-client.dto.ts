import { IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  address?: string

  @IsOptional()
  @IsString()
  passportSeries?: string

  @IsOptional()
  @IsString()
  passportNumber?: string

  @IsOptional()
  @IsString()
  notes?: string
}
