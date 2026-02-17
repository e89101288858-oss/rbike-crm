import { Controller, Get, UseGuards } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller()
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return {
      userId: user.userId,
      role: user.role,
      franchiseeId: user.franchiseeId,
    }
  }

  @Get('my/tenants')
  @UseGuards(JwtAuthGuard)
  async myTenants(@CurrentUser() user: JwtUser) {
    if (user.role === 'OWNER') {
      return this.prisma.tenant.findMany({
        orderBy: [{ franchisee: { name: 'asc' } }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          franchiseeId: true,
          franchisee: { select: { name: true } },
          dailyRateRub: true,
          minRentalDays: true,
        },
      })
    }

    if (user.role === 'FRANCHISEE') {
      return this.prisma.tenant.findMany({
        where: { franchiseeId: user.franchiseeId ?? undefined },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          franchiseeId: true,
          franchisee: { select: { name: true } },
          dailyRateRub: true,
          minRentalDays: true,
        },
      })
    }

    return this.prisma.userTenant.findMany({
      where: { userId: user.userId },
      orderBy: { tenant: { name: 'asc' } },
      select: {
        tenant: {
          select: {
            id: true,
            name: true,
            franchiseeId: true,
            franchisee: { select: { name: true } },
            dailyRateRub: true,
            minRentalDays: true,
          },
        },
      },
    }).then((rows) => rows.map((r) => r.tenant))
  }
}
