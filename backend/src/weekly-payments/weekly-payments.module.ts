import { Module } from '@nestjs/common'
import { WeeklyPaymentsController } from './weekly-payments.controller'
import { WeeklyPaymentsService } from './weekly-payments.service'

@Module({
  controllers: [WeeklyPaymentsController],
  providers: [WeeklyPaymentsService],
})
export class WeeklyPaymentsModule {}
