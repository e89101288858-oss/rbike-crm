import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminController } from './admin.controller'
import { TenantUsersController } from './tenant-users.controller'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController, TenantUsersController],
})
export class AdminModule {}
