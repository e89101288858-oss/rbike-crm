import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { SaasBillingService } from './saas-billing.service'

@Controller()
export class SaasBillingController {
  constructor(private readonly saasBilling: SaasBillingService) {}

  @Get('my/saas-billing')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles('SAAS_USER')
  async myBilling(@Req() req: Request) {
    return this.saasBilling.getMyBilling(req.tenantId!)
  }

  @Post('my/saas-billing/checkout')
  @UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
  @Roles('SAAS_USER')
  async createCheckout(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() dto: { plan?: 'STARTER' | 'PRO' | 'ENTERPRISE'; durationMonths?: 1 | 3 | 6 | 12 },
  ) {
    return this.saasBilling.createCheckout(req.tenantId!, user.userId, dto?.plan, dto?.durationMonths ?? 1)
  }

  @Post('webhooks/yookassa')
  async yookassaWebhook(@Body() payload: any) {
    return this.saasBilling.handleWebhook(payload)
  }
}
