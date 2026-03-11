import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { BatteriesController } from './batteries.controller'
import { SaasBatteriesController } from './saas-batteries.controller'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BatteriesController, SaasBatteriesController],
})
export class BatteriesModule {}
