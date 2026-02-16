import { Module } from '@nestjs/common'
import { WeeklyPaymentsAdminController } from './weekly-payments-admin.controller'
import { WeeklyPaymentsController } from './weekly-payments.controller'
import { WeeklyPaymentsService } from './weekly-payments.service'

@Module({
  controllers: [WeeklyPaymentsController, WeeklyPaymentsAdminController],
  providers: [WeeklyPaymentsService],
})
export class WeeklyPaymentsModule {}
