import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { SaasPaymentsController } from './saas-payments.controller'

@Module({
  controllers: [PaymentsController, SaasPaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
