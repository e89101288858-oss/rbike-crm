import { IsOptional, IsString } from 'class-validator'

export class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  q?: string
}
