import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DocumentType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AllowedDocumentType, CreateDocumentDto } from './dto/create-document.dto'

function mapAllowedTypeToPrisma(type: AllowedDocumentType): DocumentType {
  if (type === 'PASSPORT') {
    return DocumentType.PASSPORT_PHOTO
  }
  if (type === 'CONTRACT') {
    return DocumentType.CONTRACT
  }
  return DocumentType.ACT
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDocument(params: {
    tenantId: string
    dto: CreateDocumentDto
    filePath: string
    createdById: string
  }) {
    const { tenantId, dto, filePath, createdById } = params

    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        tenantId,
      },
    })

    if (!client) {
      throw new BadRequestException('Client not found for current tenant')
    }

    const type = mapAllowedTypeToPrisma(dto.type)

    const document = await this.prisma.document.create({
      data: {
        tenantId,
        clientId: dto.clientId,
        type,
        filePath,
        createdById,
      },
    })

    return document
  }

  async getDocument(tenantId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!document) {
      throw new NotFoundException('Document not found')
    }

    return document
  }
}

