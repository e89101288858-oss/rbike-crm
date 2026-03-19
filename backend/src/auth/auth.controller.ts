import { Body, Controller, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterRequestDto } from './dto/register-request.dto'
import { RegisterSaasDto } from './dto/register-saas.dto'
import { PasswordResetRequestDto } from './dto/password-reset-request.dto'
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto'
import { EmailConfirmDto } from './dto/email-confirm.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register-request')
  async registerRequest(@Body() dto: RegisterRequestDto) {
    return this.auth.registerRequest(dto.email, dto.password, dto.fullName, dto.phone)
  }

  @Post('register-saas')
  async registerSaas(@Body() dto: RegisterSaasDto) {
    return this.auth.registerSaas(dto)
  }

  @Post('confirm-email')
  async confirmEmail(@Body() dto: EmailConfirmDto) {
    return this.auth.confirmEmail(dto.token)
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null
    const userAgent = (req.headers['user-agent'] as string) || null
    return this.auth.login(dto.email, dto.password, ip, userAgent)
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email)
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto.token, dto.newPassword)
  }

  @Post('demo-access')
  async demoAccess() {
    return this.auth.demoAccess()
  }
}
