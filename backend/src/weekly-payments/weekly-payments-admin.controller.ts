import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { GenerateAllWeeklyPaymentsDto } from './dto/generate-all-weekly-payments.dto'
import { WeeklyPaymentsService } from './weekly-payments.service'

@Controller('weekly-payments/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class WeeklyPaymentsAdminController {
  constructor(private readonly weeklyPaymentsService: WeeklyPaymentsService) {}

  @Post('generate-all')
  async generateAll(@Body() dto: GenerateAllWeeklyPaymentsDto) {
    return this.weeklyPaymentsService.generateWeeklyForAllTenants(dto.from, dto.to)
  }
}
