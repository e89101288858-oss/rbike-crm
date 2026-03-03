import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { RegisterSaasDto } from './dto/register-saas.dto'

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

  async registerSaas(dto: RegisterSaasDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existingUser) throw new BadRequestException('Пользователь с таким email уже существует')

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const created = await this.prisma.$transaction(async (tx) => {
      const franchisee = await tx.franchisee.create({
        data: {
          name: dto.companyName,
          companyName: dto.companyName,
          city: dto.city ?? null,
          isActive: true,
        },
      })

      const tenant = await tx.tenant.create({
        data: {
          franchiseeId: franchisee.id,
          name: dto.tenantName?.trim() || `${dto.companyName} — точка 1`,
          isActive: true,
          mode: 'SAAS',
          dailyRateRub: 500,
          minRentalDays: 7,
          royaltyPercent: 0,
          saasPlan: 'STARTER',
          saasSubscriptionStatus: 'TRIAL',
          saasTrialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      })

      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: 'FRANCHISEE',
          franchiseeId: franchisee.id,
          isActive: true,
        },
      })

      await tx.userTenant.create({
        data: { userId: user.id, tenantId: tenant.id },
      })

      return { user, tenant, franchisee }
    })

    const payload = {
      userId: created.user.id,
      role: created.user.role,
      franchiseeId: created.user.franchiseeId ?? null,
    }

    const accessToken = await this.jwt.signAsync(payload)

    return {
      accessToken,
      tenantId: created.tenant.id,
      user: {
        id: created.user.id,
        email: created.user.email,
        role: created.user.role,
      },
      tenant: {
        id: created.tenant.id,
        name: created.tenant.name,
        mode: created.tenant.mode,
      },
      franchisee: {
        id: created.franchisee.id,
        name: created.franchisee.name,
      },
    }
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
