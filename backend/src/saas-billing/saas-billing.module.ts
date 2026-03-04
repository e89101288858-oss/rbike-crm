import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { SaasBillingController } from './saas-billing.controller'
import { SaasBillingService } from './saas-billing.service'

@Module({
  imports: [PrismaModule],
  controllers: [SaasBillingController],
  providers: [SaasBillingService],
})
export class SaasBillingModule {}
