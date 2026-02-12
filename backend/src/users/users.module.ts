import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { UsersController } from './users.controller'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
})
export class UsersModule {}
