import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone ?? undefined,
        notes: dto.notes ?? undefined,
      },
    })
  }

  async findAll(tenantId: string) {
    return this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId },
    })

    if (!client) {
      throw new NotFoundException('Client not found')
    }

    return client
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    // ВАЖНО: обновляем строго внутри tenant (не update by id)
    const result = await this.prisma.client.updateMany({
      where: { id, tenantId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    })

    if (result.count === 0) {
      throw new NotFoundException('Client not found')
    }

    // возвращаем обновлённую запись
    const updated = await this.prisma.client.findFirst({
      where: { id, tenantId },
    })

    // findFirst теоретически может вернуть null при гонке, поэтому страховка:
    if (!updated) {
      throw new NotFoundException('Client not found')
    }

    return updated
  }
}
