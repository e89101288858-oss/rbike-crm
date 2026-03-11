import { Module } from '@nestjs/common'
import { ClientsController } from './clients.controller'
import { SaasClientsController } from './saas-clients.controller'

@Module({
  controllers: [ClientsController, SaasClientsController],
})
export class ClientsModule {}
