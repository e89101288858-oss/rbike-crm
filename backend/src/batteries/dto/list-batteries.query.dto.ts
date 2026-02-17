import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator'

export class ListBatteriesQueryDto {
  @IsOptional()
  @IsBooleanString()
  archivedOnly?: string

  @IsOptional()
  @IsUUID()
  bikeId?: string

  @IsOptional()
  @IsString()
  q?: string
}
