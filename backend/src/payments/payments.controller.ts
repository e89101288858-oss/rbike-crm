import { Controller, Get, Param, Post, Query, Req, UseGuards, Body } from '@nestjs/common'
import type { Request } from 'express'
import type { PaymentStatus } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentsService } from './payments.service'

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    const tenantId = req.tenantId!
    return this.paymentsService.create(tenantId, dto)
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status?: PaymentStatus,
    @Query('rentalId') rentalId?: string,
  ) {
    const tenantId = req.tenantId!
    return this.paymentsService.findAll({ tenantId, status, rentalId })
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.paymentsService.findOne(tenantId, id)
  }

  @Post(':id/mark-paid')
  async markPaid(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const tenantId = req.tenantId!
    return this.paymentsService.markPaid(tenantId, id, user.userId)
  }

  @Post(':id/mark-planned')
  async markPlanned(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.paymentsService.markPlanned(tenantId, id)
  }
}
