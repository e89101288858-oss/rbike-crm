import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { DocumentType, UserRole } from '@prisma/client'
import { promises as fs } from 'fs'
import * as path from 'path'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { TenantGuard } from '../common/guards/tenant.guard'
import { PrismaService } from '../prisma/prisma.service'

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('contracts/:rentalId/generate')
  async generateContract(
    @Req() req: Request,
    @Param('rentalId') rentalId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot generate contracts')
    }

    const rental = await this.prisma.rental.findFirst({
      where: { id: rentalId, tenantId },
      include: {
        tenant: { select: { name: true, dailyRateRub: true } },
        client: { select: { fullName: true, phone: true, passportSeries: true, passportNumber: true } },
        bike: { select: { code: true, model: true } },
      },
    })

    if (!rental) throw new NotFoundException('Rental not found')

    const documentNo = `RB-${new Date().getFullYear()}-${rental.id.slice(0, 8).toUpperCase()}`
    const html = this.contractHtml({
      documentNo,
      tenantName: rental.tenant.name,
      clientName: rental.client.fullName,
      clientPhone: rental.client.phone ?? '—',
      passport: `${rental.client.passportSeries ?? ''} ${rental.client.passportNumber ?? ''}`.trim() || '—',
      bikeCode: rental.bike.code,
      bikeModel: rental.bike.model ?? '—',
      startDate: rental.startDate,
      plannedEndDate: rental.plannedEndDate,
      dailyRateRub: rental.tenant.dailyRateRub ?? 500,
      createdAt: new Date(),
    })

    const baseDir = path.join(process.cwd(), 'storage', 'documents', tenantId)
    await fs.mkdir(baseDir, { recursive: true })

    const fileName = `contract-${rental.id}-${Date.now()}.html`
    const absolute = path.join(baseDir, fileName)
    const relative = path.join('storage', 'documents', tenantId, fileName)

    await fs.writeFile(absolute, html, 'utf-8')

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        clientId: rental.clientId,
        rentalId: rental.id,
        type: DocumentType.CONTRACT,
        filePath: relative,
        createdById: user.userId,
      },
      select: { id: true, type: true, rentalId: true, createdAt: true },
    })

    return doc
  }

  @Get('by-rental/:rentalId')
  async byRental(@Req() req: Request, @Param('rentalId') rentalId: string) {
    const tenantId = req.tenantId!

    return this.prisma.document.findMany({
      where: { tenantId, rentalId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, createdAt: true, filePath: true },
    })
  }

  @Get(':id/content')
  async content(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, filePath: true, type: true, createdAt: true },
    })
    if (!doc) throw new NotFoundException('Document not found')

    const absolute = path.join(process.cwd(), doc.filePath)
    const html = await fs.readFile(absolute, 'utf-8')

    return { ...doc, html }
  }

  private contractHtml(input: {
    documentNo: string
    tenantName: string
    clientName: string
    clientPhone: string
    passport: string
    bikeCode: string
    bikeModel: string
    startDate: Date
    plannedEndDate: Date
    dailyRateRub: number
    createdAt: Date
  }) {
    const format = (d: Date) => new Date(d).toLocaleDateString('ru-RU')
    const days = Math.max(1, Math.ceil((new Date(input.plannedEndDate).getTime() - new Date(input.startDate).getTime()) / 86400000))
    const total = days * input.dailyRateRub

    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Договор аренды ${input.documentNo}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .muted { color: #666; font-size: 13px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 12px; }
  .row { margin: 6px 0; }
</style>
</head>
<body>
  <h1>ДОГОВОР АРЕНДЫ ЭЛЕКТРОВЕЛОСИПЕДА</h1>
  <div class="muted">№ ${input.documentNo} · дата: ${format(input.createdAt)}</div>

  <div class="box">
    <div class="row"><b>Точка выдачи:</b> ${input.tenantName}</div>
    <div class="row"><b>Арендатор:</b> ${input.clientName}</div>
    <div class="row"><b>Телефон:</b> ${input.clientPhone}</div>
    <div class="row"><b>Паспорт:</b> ${input.passport}</div>
  </div>

  <div class="box">
    <div class="row"><b>Транспорт:</b> ${input.bikeCode} (${input.bikeModel})</div>
    <div class="row"><b>Срок аренды:</b> ${format(input.startDate)} — ${format(input.plannedEndDate)} (${days} дн.)</div>
    <div class="row"><b>Тариф:</b> ${input.dailyRateRub} RUB/сутки</div>
    <div class="row"><b>Итого к оплате:</b> ${total} RUB</div>
  </div>

  <div class="box">
    <div class="row">Подпись арендодателя: ____________________</div>
    <div class="row">Подпись арендатора: ______________________</div>
  </div>
</body>
</html>`
  }
}
