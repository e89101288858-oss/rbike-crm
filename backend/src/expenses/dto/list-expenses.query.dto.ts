import { IsBooleanString, IsOptional, IsString } from 'class-validator'

export class ListExpensesQueryDto {
  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @IsString()
  category?: string

  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsOptional()
  @IsBooleanString()
  archivedOnly?: string
}
