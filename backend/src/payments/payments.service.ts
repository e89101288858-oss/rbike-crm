import { Injectable, NotFoundException } from '@nestjs/common'
import { PaymentKind, PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto'

function toDate(value?: string) {
  if (!value) return undefined
  return new Date(value)
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListPaymentsQueryDto) {
    const dueFrom = toDate(query.dueFrom)
    const dueTo = toDate(query.dueTo)

    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status as PaymentStatus } : {}),
        ...(query.kind ? { kind: query.kind as PaymentKind } : {}),
        ...(query.rentalId ? { rentalId: query.rentalId } : {}),
        ...(query.clientId
          ? {
              rental: {
                clientId: query.clientId,
              },
            }
          : {}),
        ...(dueFrom || dueTo
          ? {
              dueAt: {
                ...(dueFrom ? { gte: dueFrom } : {}),
                ...(dueTo ? { lte: dueTo } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        rental: {
          select: {
            id: true,
            status: true,
            client: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
            bike: {
              select: {
                id: true,
                code: true,
              },
            },
          },
        },
      },
    })
  }

  async markPaid(tenantId: string, id: string, userId: string) {
    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        markedById: userId,
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Payment not found')
    }

    return this.prisma.payment.findFirst({
      where: { id, tenantId },
    })
  }

  async markPlanned(tenantId: string, id: string) {
    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PLANNED,
        paidAt: null,
        markedById: null,
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Payment not found')
    }

    return this.prisma.payment.findFirst({
      where: { id, tenantId },
    })
  }
}
