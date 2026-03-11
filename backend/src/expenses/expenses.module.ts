import { Module } from '@nestjs/common'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'
import { SaasExpensesController } from './saas-expenses.controller'

@Module({
  controllers: [ExpensesController, SaasExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
