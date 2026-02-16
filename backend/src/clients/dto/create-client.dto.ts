import { IsOptional, IsString, MinLength } from 'class-validator'

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  fullName!: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  notes?: string
}
