import {
  BadRequestException,
  Body,
  Controller,
  Get,
  UploadedFile,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { DocumentType, UserRole } from '@prisma/client'
import { promises as fs } from 'fs'
import * as path from 'path'
import type { Request, Response } from 'express'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { FileInterceptor } from '@nestjs/platform-express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { TenantModes } from '../common/decorators/tenant-modes.decorator'
import { TenantGuard } from '../common/guards/tenant.guard'
import { TenantModeGuard } from '../common/guards/tenant-mode.guard'
import { assertSaasOperationAllowed } from '../common/saas-gating'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto'

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard, TenantModeGuard)
@TenantModes('FRANCHISE', 'SAAS')
export class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('template')
  async getTemplate(@Req() req: Request) {
    const tenantId = req.tenantId!

    const existing = await this.prisma.contractTemplate.findUnique({
      where: { tenantId },
      select: { templateHtml: true, updatedAt: true, createdAt: true },
    })

    const templateHtml = existing?.templateHtml ?? (await this.standardTemplate(req.tenantMode))

    return {
      templateHtml,
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

  @Post('template/reset')
  async resetTemplate(@Req() req: Request, @CurrentUser() user: JwtUser) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }

    const updated = await this.prisma.contractTemplate.upsert({
      where: { tenantId },
      create: { tenantId, templateHtml: await this.standardTemplate(req.tenantMode), updatedById: user.userId },
      update: { templateHtml: await this.standardTemplate(req.tenantMode), updatedById: user.userId },
      select: { tenantId: true, updatedAt: true },
    })

    return { ok: true, ...updated }
  }

  @Get('template/docx')
  async downloadTemplateDocx(@Req() req: Request, @Res() res: Response) {
    const tenantId = req.tenantId!
    const absolute = await this.getTenantTemplatePath(tenantId, req.tenantMode)
    return res.download(absolute, `contract-template-${tenantId}.docx`)
  }

  @Post('template/docx')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemplateDocx(@Req() req: Request, @CurrentUser() user: JwtUser, @UploadedFile() file?: any) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }
    if (!file?.buffer) {
      throw new BadRequestException('Файл шаблона не передан')
    }

    const fileName = String(file.originalname || '').toLowerCase()
    const contentType = String(file.mimetype || '').toLowerCase()
    if (!fileName.endsWith('.docx') && !contentType.includes('officedocument.wordprocessingml.document')) {
      throw new BadRequestException('Нужен файл формата .docx')
    }

    const dir = path.join(process.cwd(), 'storage', 'contract-templates')
    await fs.mkdir(dir, { recursive: true })
    const target = path.join(dir, `${tenantId}.docx`)
    await fs.writeFile(target, file.buffer)

    return { ok: true }
  }

  @Post('template/docx/json')
  async uploadTemplateDocxJson(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() body: { filename?: string; dataBase64?: string },
  ) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }

    const filename = String(body?.filename || '').toLowerCase()
    const dataBase64 = String(body?.dataBase64 || '')
    if (!filename.endsWith('.docx') || !dataBase64) {
      throw new BadRequestException('Нужен файл формата .docx')
    }

    let buffer: Buffer
    try {
      buffer = Buffer.from(dataBase64, 'base64')
    } catch {
      throw new BadRequestException('Некорректный base64 файла')
    }

    const dir = path.join(process.cwd(), 'storage', 'contract-templates')
    await fs.mkdir(dir, { recursive: true })
    const target = path.join(dir, `${tenantId}.docx`)
    await fs.writeFile(target, buffer)

    return { ok: true }
  }

  @Post('template/docx/chunk')
  async uploadTemplateDocxChunk(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() body: { filename?: string; chunkBase64?: string; chunkIndex?: number; totalChunks?: number },
  ) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }

    const filename = String(body?.filename || '').toLowerCase()
    const chunkBase64 = String(body?.chunkBase64 || '')
    const chunkIndex = Number(body?.chunkIndex ?? -1)
    const totalChunks = Number(body?.totalChunks ?? 0)

    if (!filename.endsWith('.docx') || !chunkBase64 || chunkIndex < 0 || totalChunks <= 0) {
      throw new BadRequestException('Некорректные параметры загрузки')
    }

    const dir = path.join(process.cwd(), 'storage', 'contract-templates')
    await fs.mkdir(dir, { recursive: true })

    const tmpPath = path.join(dir, `${tenantId}.upload.tmp`)
    const target = path.join(dir, `${tenantId}.docx`)

    if (chunkIndex === 0) {
      try { await fs.unlink(tmpPath) } catch {}
    }

    let buf: Buffer
    try {
      buf = Buffer.from(chunkBase64, 'base64')
    } catch {
      throw new BadRequestException('Некорректный base64 блока')
    }

    await fs.appendFile(tmpPath, buf)

    if (chunkIndex === totalChunks - 1) {
      await fs.rename(tmpPath, target)
    }

    return { ok: true, done: chunkIndex === totalChunks - 1 }
  }

  @Post('template/docx/reset')
  async resetTemplateDocx(@Req() req: Request, @CurrentUser() user: JwtUser) {
    const tenantId = req.tenantId!

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot update contract template')
    }

    const target = path.join(process.cwd(), 'storage', 'contract-templates', `${tenantId}.docx`)
    try {
      await fs.unlink(target)
    } catch {}

    return { ok: true }
  }

  @Post('contracts/:rentalId/generate')
  async generateContract(
    @Req() req: Request,
    @Param('rentalId') rentalId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const tenantId = req.tenantId!

    await assertSaasOperationAllowed(this.prisma, tenantId, 'GENERATE_CONTRACT')

    if (user.role === UserRole.MECHANIC) {
      throw new BadRequestException('MECHANIC cannot generate contracts')
    }

    const rental = await this.prisma.rental.findFirst({
      where: { id: rentalId, tenantId },
      include: {
        tenant: {
          select: {
            name: true,
            address: true,
            dailyRateRub: true,
            franchisee: { select: { name: true, companyName: true, signerFullName: true, bankDetails: true, city: true } },
          },
        },
        client: {
          select: {
            fullName: true,
            phone: true,
            birthDate: true,
            address: true,
            emergencyContactPhone: true,
            passportSeries: true,
            passportNumber: true,
          },
        },
        bike: { select: { code: true, model: true, frameNumber: true, motorWheelNumber: true } },
        batteries: { include: { battery: { select: { code: true } } } },
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

    const data = {
      'contract.number': documentNo,
      'contract.date': this.fmt(new Date()),

      'tenant.name': rental.tenant.name,
      'tenant.address': rental.tenant.address ?? '—',

      'franchisee.name': rental.tenant.franchisee?.name ?? rental.tenant.name,
      'franchisee.companyName': rental.tenant.franchisee?.companyName ?? rental.tenant.name,
      'franchisee.signerFullName': rental.tenant.franchisee?.signerFullName ?? '—',
      'franchisee.bankDetails': rental.tenant.franchisee?.bankDetails ?? '—',
      'franchisee.city': rental.tenant.franchisee?.city ?? '—',

      'company.name': rental.tenant.franchisee?.name ?? rental.tenant.name,
      'company.legalName': rental.tenant.franchisee?.companyName ?? rental.tenant.name,
      'company.signerFullName': rental.tenant.franchisee?.signerFullName ?? '—',
      'company.bankDetails': rental.tenant.franchisee?.bankDetails ?? '—',
      'company.city': rental.tenant.franchisee?.city ?? '—',

      'client.fullName': rental.client.fullName,
      'client.phone': rental.client.phone ?? '—',
      'client.birthDate': rental.client.birthDate ? this.fmt(rental.client.birthDate) : '—',
      'client.address': rental.client.address ?? '—',
      'client.emergencyContactPhone': rental.client.emergencyContactPhone ?? '—',
      'client.passportSeries': rental.client.passportSeries ?? '—',
      'client.passportNumber': rental.client.passportNumber ?? '—',

      'bike.code': rental.bike.code,
      'bike.model': rental.bike.model ?? '—',
      'bike.frameNumber': rental.bike.frameNumber ?? '—',
      'bike.motorWheelNumber': rental.bike.motorWheelNumber ?? '—',

      'batteries.numbers': rental.batteries.map((x) => x.battery.code).join(', ') || '—',

      'rental.startDate': this.fmt(rental.startDate),
      'rental.plannedEndDate': this.fmt(rental.plannedEndDate),
      'rental.days': String(days),
      'rental.dailyRateRub': String(dailyRateRub),
      'rental.totalRub': String(totalRub),
    }

    const baseDir = path.join(process.cwd(), 'storage', 'documents', tenantId)
    await fs.mkdir(baseDir, { recursive: true })

    const fileName = `contract-${rental.id}-${Date.now()}.docx`
    const absolute = path.join(baseDir, fileName)
    const relative = path.join('storage', 'documents', tenantId, fileName)

    const templatePath = await this.getTenantTemplatePath(tenantId, req.tenantMode)
    const tplBuffer = await fs.readFile(templatePath)
    const zip = new PizZip(tplBuffer)
    const docx = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
    })

    try {
      docx.render(data)
    } catch {
      throw new BadRequestException('Ошибка шаблона DOCX: проверьте теги и структуру документа')
    }

    const out = docx.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    await fs.writeFile(absolute, out)

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

  @Get(':id/download')
  async download(@Req() req: Request, @Param('id') id: string, @Res() res: Response) {
    const tenantId = req.tenantId!

    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, filePath: true },
    })
    if (!doc) throw new NotFoundException('Document not found')

    const absolute = path.join(process.cwd(), doc.filePath)
    return res.download(absolute, path.basename(absolute))
  }

  @Get(':id/content')
  async content(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!

    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
      select: { id: true, filePath: true, type: true, createdAt: true },
    })
    if (!doc) throw new NotFoundException('Document not found')
    if (!doc.filePath.endsWith('.html')) {
      throw new BadRequestException('For DOCX use download endpoint')
    }

    const absolute = path.join(process.cwd(), doc.filePath)
    const html = await fs.readFile(absolute, 'utf-8')

    return { ...doc, html }
  }

  private async getTenantTemplatePath(tenantId: string, mode?: string) {
    const custom = path.join(process.cwd(), 'storage', 'contract-templates', `${tenantId}.docx`)
    try {
      await fs.access(custom)
      return custom
    } catch {}

    return this.getModeDefaultTemplatePath(mode)
  }

  private async getModeDefaultTemplatePath(mode?: string) {
    const base = path.join(process.cwd(), 'templates', 'contract-template.docx')
    if (mode !== 'SAAS') return base

    const dir = path.join(process.cwd(), 'storage', 'contract-templates', '_defaults')
    const saasPath = path.join(dir, 'saas-template.docx')

    try {
      const existing = await fs.readFile(saasPath)
      const existingZip = new PizZip(existing)
      const existingXml = existingZip.file('word/document.xml')?.asText() || ''
      if (existingXml.includes('{{company.') && !existingXml.includes('{{franchisee.')) {
        return saasPath
      }
    } catch {}

    const buf = await fs.readFile(base)
    const zip = new PizZip(buf)
    const xmlFiles = Object.keys((zip as any).files || {}).filter((k) => k.startsWith('word/') && k.endsWith('.xml'))
    for (const f of xmlFiles) {
      const txt = zip.file(f)?.asText()
      if (!txt) continue
      zip.file(f, this.toSaasTags(txt))
    }

    await fs.mkdir(dir, { recursive: true })
    const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    await fs.writeFile(saasPath, out)

    return saasPath
  }

  private applyTemplate(template: string, data: Record<string, string>) {
    return template.replace(/\{\{\s*([a-zA-Z0-9._-]+)\s*\}\}/g, (_, key: string) => data[key] ?? '—')
  }

  private prepareHtmlForDocx(html: string) {
    return html
      .replace(/break-before\s*:\s*page\s*;?/gi, 'page-break-before: always;')
      .replace(/<div\s+class=["']page-break["'][^>]*><\/div>/gi, '<p style="page-break-after: always; margin:0; padding:0; line-height:0;">&nbsp;</p>')
      .replace(/position\s*:\s*sticky\s*;?/gi, '')
  }

  private prepareHtmlForDocxStrict(html: string) {
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<li[^>]*>\s*(<h[1-3][\s\S]*?<\/h[1-3]>)\s*<\/li>/gi, '$1')
      .replace(/<p[^>]*>\s*&nbsp;\s*<\/p>/gi, '')
      .replace(/<colgroup[\s\S]*?<\/colgroup>/gi, '')
      .replace(/\scontenteditable=("[^"]*"|'[^']*')/gi, '')
      .replace(/\sdata-[a-z0-9_-]+=("[^"]*"|'[^']*')/gi, '')
      .replace(/<div\s+class=["']page-break["'][^>]*><\/div>/gi, '<p style="page-break-after: always; margin:0; padding:0; line-height:0;">&nbsp;</p>')
      .replace(/<table([^>]*)>/gi, '<table style="width:100%; border-collapse:collapse; margin:8px 0 12px;">')
      .replace(/<(td|th)([^>]*)>/gi, '<$1 style="border:1px solid #666; padding:6px; vertical-align:top;">')
      .replace(/<(td|th)([^>]*)>\s*<\/(td|th)>/gi, (_m, tag) => `<${tag} style="border:1px solid #666; padding:6px; vertical-align:top;">&nbsp;</${tag}>`)
      .replace(/style=("|')[\s\S]*?(display\s*:\s*grid|display\s*:\s*flex|position\s*:\s*sticky|min-height\s*:|height\s*:|margin-top\s*:\s*\d{2,}px)[\s\S]*?("|')/gi, '')
  }

  private toSaasTags(templateHtml: string) {
    return templateHtml
      .replace(/\{\{\s*franchisee\.name\s*\}\}/g, '{{company.name}}')
      .replace(/\{\{\s*franchisee\.companyName\s*\}\}/g, '{{company.legalName}}')
      .replace(/\{\{\s*franchisee\.signerFullName\s*\}\}/g, '{{company.signerFullName}}')
      .replace(/\{\{\s*franchisee\.bankDetails\s*\}\}/g, '{{company.bankDetails}}')
      .replace(/\{\{\s*franchisee\.city\s*\}\}/g, '{{company.city}}')
  }

  private async standardTemplate(mode?: string) {
    if (mode === 'SAAS') {
      const franchiseSeed = await this.prisma.contractTemplate.findFirst({
        where: { tenant: { mode: 'FRANCHISE' } },
        orderBy: { updatedAt: 'desc' },
        select: { templateHtml: true },
      })
      const base = franchiseSeed?.templateHtml ?? this.defaultTemplate()
      return this.toSaasTags(base)
    }
    return this.defaultTemplate()
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
    <div class="row"><b>Город франчайзи:</b> {{franchisee.city}}</div>
    <div class="row"><b>Точка выдачи:</b> {{tenant.name}}</div>
    <div class="row"><b>Адрес возврата электровелосипеда:</b> {{tenant.address}}</div>
  </div>

  <div class="box">
    <div class="row"><b>Арендатор:</b> {{client.fullName}}</div>
    <div class="row"><b>Телефон:</b> {{client.phone}}</div>
    <div class="row"><b>Дата рождения:</b> {{client.birthDate}}</div>
    <div class="row"><b>Адрес проживания:</b> {{client.address}}</div>
    <div class="row"><b>Телефон родственника/знакомого:</b> {{client.emergencyContactPhone}}</div>
    <div class="row"><b>Паспорт:</b> {{client.passportSeries}} {{client.passportNumber}}</div>
  </div>

  <div class="box">
    <div class="row"><b>Транспорт:</b> {{bike.code}} ({{bike.model}})</div>
    <div class="row"><b>Номер рамы:</b> {{bike.frameNumber}}</div>
    <div class="row"><b>Номер мотор-колеса:</b> {{bike.motorWheelNumber}}</div>
    <div class="row"><b>Номера АКБ:</b> {{batteries.numbers}}</div>
    <div class="row"><b>Срок аренды:</b> {{rental.startDate}} — {{rental.plannedEndDate}} ({{rental.days}} дн.)</div>
    <div class="row"><b>Тариф:</b> {{rental.dailyRateRub}} RUB/сутки</div>
    <div class="row"><b>Итого к оплате:</b> {{rental.totalRub}} RUB</div>
  </div>

</body>
</html>`
  }
}
