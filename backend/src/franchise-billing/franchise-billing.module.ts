import { Module } from '@nestjs/common'
import { FranchiseBillingController } from './franchise-billing.controller'
import { FranchiseBillingService } from './franchise-billing.service'

@Module({
  controllers: [FranchiseBillingController],
  providers: [FranchiseBillingService],
})
export class FranchiseBillingModule {}
