import { Module } from '@nestjs/common'
import { RentalsController } from './rentals.controller'
import { SaasRentalsController } from './saas-rentals.controller'

@Module({
  controllers: [RentalsController, SaasRentalsController],
})
export class RentalsModule {}
