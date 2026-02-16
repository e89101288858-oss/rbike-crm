import { IsBooleanString, IsOptional } from 'class-validator'

export class ListBikesQueryDto {
  @IsOptional()
  @IsBooleanString()
  includeArchived?: string
}
