import { IsBooleanString, IsOptional } from 'class-validator'

export class ListBikesQueryDto {
  @IsOptional()
  @IsBooleanString()
  archivedOnly?: string
}
