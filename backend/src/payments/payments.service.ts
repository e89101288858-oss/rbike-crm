import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePaymentDto } from './dto/create-payment.dto'

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePaymentDto) {
    const rental = await this.prisma.rental.findFirst({
      where: { id: dto.rentalId, tenantId },
      select: { id: true },
    })
    if (!rental) {
      throw new BadRequestException('Rental not found for current tenant')
    }

    return this.prisma.payment.create({
      data: {
        tenantId,
        rentalId: dto.rentalId,
        amount: dto.amount,
        status: PaymentStatus.PLANNED,
      },
    })
  }

  async findAll(params: { tenantId: string; status?: PaymentStatus; rentalId?: string }) {
    const { tenantId, status, rentalId } = params
    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(rentalId ? { rentalId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        rental: {
          select: {
            id: true,
            status: true,
            bike: { select: { id: true, code: true } },
            client: { select: { id: true, fullName: true } },
          },
        },
      },
    })
  }

  async findOne(tenantId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: {
        rental: {
          select: {
            id: true,
            status: true,
            bike: { select: { id: true, code: true } },
            client: { select: { id: true, fullName: true } },
          },
        },
      },
    })
    if (!payment) throw new NotFoundException('Payment not found')
    return payment
  }

  async markPaid(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    })
    if (!existing) throw new NotFoundException('Payment not found')

    // tenant-safe update
    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        markedById: userId,
      },
    })
    if (result.count === 0) throw new NotFoundException('Payment not found')

    return this.findOne(tenantId, id)
  }

  async markPlanned(tenantId: string, id: string) {
    const existing = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      select: { id: true },
    })
    if (!existing) throw new NotFoundException('Payment not found')

    const result = await this.prisma.payment.updateMany({
      where: { id, tenantId },
      data: {
        status: PaymentStatus.PLANNED,
        paidAt: null,
        markedById: null,
      },
    })
    if (result.count === 0) throw new NotFoundException('Payment not found')

    return this.findOne(tenantId, id)
  }
}
