import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { BikesController } from './bikes.controller'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BikesController],
})
export class BikesModule {}
