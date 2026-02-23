import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto'
import { UpdateExpenseDto } from './dto/update-expense.dto'
import { ExpensesService } from './expenses.service'

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('OWNER', 'FRANCHISEE', 'MANAGER')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListExpensesQueryDto) {
    return this.expensesService.list(req.tenantId!, query)
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateExpenseDto, @CurrentUser() user: JwtUser) {
    return this.expensesService.create(req.tenantId!, dto, user.userId)
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(req.tenantId!, id, dto)
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.expensesService.remove(req.tenantId!, id)
  }

  @Post(':id/restore')
  restore(@Req() req: Request, @Param('id') id: string) {
    return this.expensesService.restore(req.tenantId!, id)
  }
}
