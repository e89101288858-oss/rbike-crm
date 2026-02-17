import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { BikesModule } from './bikes/bikes.module'
import { BatteriesModule } from './batteries/batteries.module'
import { PrismaModule } from './prisma/prisma.module'
import { UsersModule } from './users/users.module'
import { FranchiseBillingModule } from './franchise-billing/franchise-billing.module'
import { WeeklyPaymentsModule } from './weekly-payments/weekly-payments.module'
import { RentalsModule } from './rentals/rentals.module'
import { ClientsModule } from './clients/clients.module'
import { PaymentsModule } from './payments/payments.module'
import { DocumentsModule } from './documents/documents.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    UsersModule,
    BikesModule,
    BatteriesModule,
    FranchiseBillingModule,
    WeeklyPaymentsModule,
    RentalsModule,
    ClientsModule,
    PaymentsModule,
    DocumentsModule,
  ],
})
export class AppModule {}
