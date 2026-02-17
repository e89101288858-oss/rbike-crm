import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
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
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto'

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('template')
  async getTemplate(@Req() req: Request) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.contractTemplate.findUnique({
      where: { tenantId },
      select: { templateHtml: true, updatedAt: true, createdAt: true },
    })

    return {
      templateHtml: existing?.templateHtml ?? this.defaultTemplate(),
      updatedAt: existing?.updatedAt ?? null,
      createdAt: existing?.createdAt ?? null,
    }
  }

  @Patch('template')
  async updateTemplate(@Req() req: Request, @CurrentUser() user: JwtUser, @Body() dto: UpdateContractTemplateDto) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }

    const updated = await this.prisma.contractTemplate.upsert({
      where: { tenantId },
      create: { tenantId, templateHtml: dto.templateHtml, updatedById: user.userId },
      update: { templateHtml: dto.templateHtml, updatedById: user.userId },
      select: { tenantId: true, updatedAt: true },
    })

    return { ok: true, ...updated }
  }

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
        tenant: {
          select: {
            name: true,
            dailyRateRub: true,
            franchisee: { select: { name: true, companyName: true, signerFullName: true, bankDetails: true } },
          },
        },
        client: {
          select: {
            fullName: true,
            phone: true,
            address: true,
            emergencyContactPhone: true,
            passportSeries: true,
            passportNumber: true,
          },
        },
        bike: { select: { code: true, model: true } },
      },
    })

    if (!rental) throw new NotFoundException('Rental not found')

    const documentNo = `RB-${new Date().getFullYear()}-${rental.id.slice(0, 8).toUpperCase()}`
    const days = Math.max(
      1,
      Math.ceil((new Date(rental.plannedEndDate).getTime() - new Date(rental.startDate).getTime()) / 86400000),
    )
    const dailyRateRub = rental.tenant.dailyRateRub ?? 500
    const totalRub = days * dailyRateRub

    const template = await this.prisma.contractTemplate.findUnique({
      where: { tenantId },
      select: { templateHtml: true },
    })

    const html = this.applyTemplate(template?.templateHtml ?? this.defaultTemplate(), {
      'contract.number': documentNo,
      'contract.date': this.fmt(new Date()),
      'tenant.name': rental.tenant.name,
      'franchisee.name': rental.tenant.franchisee?.name ?? '—',
      'franchisee.companyName': rental.tenant.franchisee?.companyName ?? '—',
      'franchisee.signerFullName': rental.tenant.franchisee?.signerFullName ?? '—',
      'franchisee.bankDetails': rental.tenant.franchisee?.bankDetails ?? '—',
      'client.fullName': rental.client.fullName,
      'client.phone': rental.client.phone ?? '—',
      'client.address': rental.client.address ?? '—',
      'client.emergencyContactPhone': rental.client.emergencyContactPhone ?? '—',
      'client.passportSeries': rental.client.passportSeries ?? '—',
      'client.passportNumber': rental.client.passportNumber ?? '—',
      'bike.code': rental.bike.code,
      'bike.model': rental.bike.model ?? '—',
      'rental.startDate': this.fmt(rental.startDate),
      'rental.plannedEndDate': this.fmt(rental.plannedEndDate),
      'rental.days': String(days),
      'rental.dailyRateRub': String(dailyRateRub),
      'rental.totalRub': String(totalRub),
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

  private applyTemplate(template: string, data: Record<string, string>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g, (_, key: string) => data[key] ?? '—')
  }

  private fmt(d: Date | string) {
    return new Date(d).toLocaleDateString('ru-RU')
  }

  private defaultTemplate() {
    return `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<title>Договор аренды {{contract.number}}</title>
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
  <div class="muted">№ {{contract.number}} · дата: {{contract.date}}</div>

  <div class="box">
    <div class="row"><b>Франчайзи:</b> {{franchisee.name}}</div>
    <div class="row"><b>Название компании:</b> {{franchisee.companyName}}</div>
    <div class="row"><b>Подписант со стороны франчайзи:</b> {{franchisee.signerFullName}}</div>
    <div class="row"><b>Банковские реквизиты:</b> {{franchisee.bankDetails}}</div>
    <div class="row"><b>Точка выдачи:</b> {{tenant.name}}</div>
  </div>

  <div class="box">
    <div class="row"><b>Арендатор:</b> {{client.fullName}}</div>
    <div class="row"><b>Телефон:</b> {{client.phone}}</div>
    <div class="row"><b>Адрес проживания:</b> {{client.address}}</div>
    <div class="row"><b>Телефон родственника/знакомого:</b> {{client.emergencyContactPhone}}</div>
    <div class="row"><b>Паспорт:</b> {{client.passportSeries}} {{client.passportNumber}}</div>
  </div>

  <div class="box">
    <div class="row"><b>Транспорт:</b> {{bike.code}} ({{bike.model}})</div>
    <div class="row"><b>Срок аренды:</b> {{rental.startDate}} — {{rental.plannedEndDate}} ({{rental.days}} дн.)</div>
    <div class="row"><b>Тариф:</b> {{rental.dailyRateRub}} RUB/сутки</div>
    <div class="row"><b>Итого к оплате:</b> {{rental.totalRub}} RUB</div>
  </div>

  <div class="box">
    <div class="row">Подпись арендодателя: ____________________</div>
    <div class="row">Подпись арендатора: ______________________</div>
  </div>
</body>
</html>`
  }
}
