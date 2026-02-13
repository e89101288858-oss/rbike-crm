import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { AdminModule } from './admin/admin.module'
import { BikesModule } from './bikes/bikes.module'
import { ClientsModule } from './clients/clients.module'
import { DocumentsModule } from './documents/documents.module'
import { RentalsModule } from './rentals/rentals.module'
import { PaymentsModule } from './payments/payments.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    BikesModule,
    ClientsModule,
    DocumentsModule,
    RentalsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
