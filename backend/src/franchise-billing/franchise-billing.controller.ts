import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { MonthQueryDto } from './dto/month-query.dto'
import { FranchiseBillingService } from './franchise-billing.service'

@Controller('franchise-billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FranchiseBillingController {
  constructor(private readonly franchiseBillingService: FranchiseBillingService) {}

  @Get('owner/monthly')
  @Roles('OWNER')
  async ownerMonthly(@Query() query: MonthQueryDto) {
    return this.franchiseBillingService.buildOwnerMonthlyReport(
      query.month,
      query.includeZero ?? false,
    )
  }

  @Get('my/monthly')
  @Roles('FRANCHISEE')
  async myMonthly(@CurrentUser() user: JwtUser, @Query() query: MonthQueryDto) {
    if (!user.franchiseeId) {
      throw new BadRequestException('franchiseeId is missing in user token')
    }

    return this.franchiseBillingService.buildFranchiseeMonthlyReport(
      user.franchiseeId,
      query.month,
      query.includeZero ?? false,
    )
  }
}
