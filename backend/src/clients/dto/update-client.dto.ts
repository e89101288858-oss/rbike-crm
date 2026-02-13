import { IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  notes?: string
}

