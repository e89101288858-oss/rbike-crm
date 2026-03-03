import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from './jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { UpdateMyTenantSettingsDto } from './dto/update-my-tenant-settings.dto'

@Controller('my/tenant-settings')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class MyTenantSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSettings(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        mode: true,
        dailyRateRub: true,
        minRentalDays: true,
        royaltyPercent: true,
      },
    })
  }

  @Patch()
  async updateSettings(@Req() req: Request, @Body() dto: UpdateMyTenantSettingsDto) {
    const tenantId = req.tenantId!
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.dailyRateRub !== undefined && { dailyRateRub: dto.dailyRateRub }),
        ...(dto.minRentalDays !== undefined && { minRentalDays: Math.trunc(dto.minRentalDays) }),
        ...(dto.royaltyPercent !== undefined && { royaltyPercent: dto.royaltyPercent }),
      },
      select: {
        id: true,
        name: true,
        mode: true,
        dailyRateRub: true,
        minRentalDays: true,
        royaltyPercent: true,
      },
    })
  }
}
