import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { DebtsQueryDto } from './dto/debts-query.dto'
import { GenerateWeeklyPaymentsDto } from './dto/generate-weekly-payments.dto'
import { WeeklyPaymentsService } from './weekly-payments.service'

@Controller('weekly-payments')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class WeeklyPaymentsController {
  constructor(private readonly weeklyPaymentsService: WeeklyPaymentsService) {}

  @Post('generate')
  async generate(@Req() req: Request, @Body() dto: GenerateWeeklyPaymentsDto) {
    const tenantId = req.tenantId!
    return this.weeklyPaymentsService.generateWeekly(tenantId, dto.from, dto.to)
  }

  @Get('debts')
  async debts(@Req() req: Request, @Query() query: DebtsQueryDto) {
    const tenantId = req.tenantId!
    return this.weeklyPaymentsService.debts(tenantId, query.overdueOnly ?? true)
  }
}
