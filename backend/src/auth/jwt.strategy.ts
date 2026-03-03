import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload?.userId },
      select: { id: true, role: true, franchiseeId: true, isActive: true, tokenVersion: true },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User is inactive')
    }

    const tokenVersion = Number(payload?.tokenVersion ?? 0)
    if (tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Session revoked')
    }

    return {
      userId: user.id,
      role: user.role,
      franchiseeId: user.franchiseeId,
      tokenVersion: user.tokenVersion,
    }
  }
}
