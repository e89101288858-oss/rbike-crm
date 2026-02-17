import { IsBooleanString, IsOptional, IsString } from 'class-validator'

export class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  q?: string

  @IsOptional()
  @IsBooleanString()
  archivedOnly?: string
}
