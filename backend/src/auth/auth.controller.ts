import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterRequestDto } from './dto/register-request.dto'
import { RegisterSaasDto } from './dto/register-saas.dto'

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

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }
}
