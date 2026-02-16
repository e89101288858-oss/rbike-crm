import { Module } from '@nestjs/common'
import { RentalsController } from './rentals.controller'

@Module({
  controllers: [RentalsController],
})
export class RentalsModule {}
