import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async registerRequest(email: string, password: string, fullName?: string, phone?: string) {
    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует')

    const existingReq = await this.prisma.registrationRequest.findUnique({ where: { email } })
    if (existingReq && existingReq.status === 'PENDING') {
      throw new BadRequestException('Заявка с таким email уже отправлена')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (existingReq) {
      await this.prisma.registrationRequest.update({
        where: { email },
        data: {
          passwordHash,
          fullName: fullName ?? null,
          phone: phone ?? null,
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
        },
      })
    } else {
      await this.prisma.registrationRequest.create({
        data: { email, passwordHash, fullName: fullName ?? null, phone: phone ?? null },
      })
    }

    return { ok: true }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload = {
      userId: user.id,
      role: user.role,
      franchiseeId: user.franchiseeId ?? null,
    }

    const accessToken = await this.jwt.signAsync(payload)
    return { accessToken }
  }
}
