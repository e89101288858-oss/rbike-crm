import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto'
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
