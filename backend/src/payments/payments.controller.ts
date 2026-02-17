import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto'
import { RevenueByBikeQueryDto } from './dto/revenue-by-bike.query.dto'
import { RevenueByDaysQueryDto } from './dto/revenue-by-days.query.dto'
import { UpdatePaymentDto } from './dto/update-payment.dto'
import { PaymentsService } from './payments.service'

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async list(@Req() req: Request, @Query() query: ListPaymentsQueryDto) {
    const tenantId = req.tenantId!
    return this.paymentsService.list(tenantId, query)
  }

  @Get('revenue-by-bike')
  async revenueByBike(@Req() req: Request, @Query() query: RevenueByBikeQueryDto) {
    const tenantId = req.tenantId!
    return this.paymentsService.revenueByBike(tenantId, query.from, query.to, query.bikeId)
  }

  @Get('revenue-by-days')
  async revenueByDays(@Req() req: Request, @Query() query: RevenueByDaysQueryDto) {
    const tenantId = req.tenantId!
    return this.paymentsService.revenueByDays(tenantId, query.from, query.to)
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    const tenantId = req.tenantId!
    return this.paymentsService.update(tenantId, id, dto)
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.paymentsService.remove(tenantId, id)
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
