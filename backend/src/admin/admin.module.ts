import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { AdminController } from './admin.controller'
import { TenantUsersController } from './tenant-users.controller'
import { SaasBillingModule } from '../saas-billing/saas-billing.module'

@Module({
  imports: [PrismaModule, AuthModule, SaasBillingModule],
  controllers: [AdminController, TenantUsersController],
})
export class AdminModule {}
