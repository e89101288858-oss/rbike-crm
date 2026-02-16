import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ImportClientRowDto {
  @IsString()
  fullName!: string

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

export class ImportClientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportClientRowDto)
  rows!: ImportClientRowDto[]
}
