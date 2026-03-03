import { IsString, MinLength } from 'class-validator'

export class PasswordResetConfirmDto {
  @IsString()
  token!: string

  @IsString()
  @MinLength(6)
  newPassword!: string
}
