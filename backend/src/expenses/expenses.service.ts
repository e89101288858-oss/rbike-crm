import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ExpenseScopeType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ListExpensesQueryDto } from './dto/list-expenses.query.dto'
import { UpdateExpenseDto } from './dto/update-expense.dto'

function toDate(value?: string) {
  if (!value) return undefined
  return new Date(value)
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListExpensesQueryDto) {
    const from = toDate(query.from)
    const to = toDate(query.to)
    const archivedOnly = query.archivedOnly === 'true'

    return this.prisma.expense.findMany({
      where: {
        tenantId,
        isActive: archivedOnly ? false : true,
        ...(query.category ? { category: query.category } : {}),
        ...(query.q
          ? {
              OR: [
                { category: { contains: query.q, mode: 'insensitive' } },
                { notes: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(from || to
          ? {
              spentAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        bikes: { include: { bike: { select: { id: true, code: true } } } },
      },
      orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
    })
  }

  private async validateBikeIds(tenantId: string, bikeIds: string[]) {
    if (!bikeIds.length) return
    const found = await this.prisma.bike.findMany({
      where: { tenantId, id: { in: bikeIds } },
      select: { id: true },
    })
    if (found.length !== bikeIds.length) throw new BadRequestException('Некоторые велосипеды не найдены в выбранной точке')
  }

  private validateScope(scopeType: ExpenseScopeType, bikeIds: string[]) {
    if (scopeType === ExpenseScopeType.SINGLE && bikeIds.length !== 1) {
      throw new BadRequestException('Для SINGLE нужно выбрать ровно 1 велосипед')
    }
    if (scopeType === ExpenseScopeType.MULTI && bikeIds.length < 1) {
      throw new BadRequestException('Для MULTI нужно выбрать минимум 1 велосипед')
    }
    if (scopeType === ExpenseScopeType.ALL_BIKES && bikeIds.length > 0) {
      throw new BadRequestException('Для ALL_BIKES не нужно указывать конкретные велосипеды')
    }
  }

  async create(tenantId: string, dto: CreateExpenseDto, userId?: string) {
    const bikeIds = Array.from(new Set(dto.bikeIds ?? []))
    this.validateScope(dto.scopeType, bikeIds)
    await this.validateBikeIds(tenantId, bikeIds)

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          tenantId,
          amountRub: dto.amountRub,
          category: dto.category,
          notes: dto.notes ?? null,
          spentAt: new Date(dto.spentAt),
          scopeType: dto.scopeType,
          createdById: userId ?? null,
          isActive: true,
        },
      })

      if (bikeIds.length) {
        await tx.expenseBike.createMany({
          data: bikeIds.map((bikeId) => ({ tenantId, expenseId: created.id, bikeId })),
        })
      }

      return tx.expense.findUnique({
        where: { id: created.id },
        include: { bikes: { include: { bike: { select: { id: true, code: true } } } } },
      })
    })
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    const existing = await this.prisma.expense.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('Expense not found')

    const nextScope = dto.scopeType ?? existing.scopeType
    const bikeIds = Array.from(new Set(dto.bikeIds ?? (await this.prisma.expenseBike.findMany({ where: { expenseId: id }, select: { bikeId: true } })).map((x) => x.bikeId)))

    this.validateScope(nextScope, bikeIds)
    await this.validateBikeIds(tenantId, bikeIds)

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.updateMany({
        where: { id, tenantId },
        data: {
          ...(dto.amountRub !== undefined && { amountRub: dto.amountRub }),
          ...(dto.category !== undefined && { category: dto.category }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.spentAt !== undefined && { spentAt: new Date(dto.spentAt) }),
          ...(dto.scopeType !== undefined && { scopeType: dto.scopeType }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      })

      await tx.expenseBike.deleteMany({ where: { expenseId: id } })
      if (bikeIds.length) {
        await tx.expenseBike.createMany({
          data: bikeIds.map((bikeId) => ({ tenantId, expenseId: id, bikeId })),
        })
      }
    })

    return this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: { bikes: { include: { bike: { select: { id: true, code: true } } } } },
    })
  }

  async remove(tenantId: string, id: string) {
    const updated = await this.prisma.expense.updateMany({ where: { id, tenantId }, data: { isActive: false } })
    if (!updated.count) throw new NotFoundException('Expense not found')
    return { id, archived: true }
  }

  async restore(tenantId: string, id: string) {
    const updated = await this.prisma.expense.updateMany({ where: { id, tenantId }, data: { isActive: true } })
    if (!updated.count) throw new NotFoundException('Expense not found')
    return { id, restored: true }
  }
}
