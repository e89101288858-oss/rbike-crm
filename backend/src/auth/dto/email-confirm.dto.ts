import { IsString, MinLength } from 'class-validator'

export class EmailConfirmDto {
  @IsString()
  @MinLength(16)
  token!: string
}
