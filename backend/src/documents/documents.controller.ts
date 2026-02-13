import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import { diskStorage } from 'multer'
import { randomUUID } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CreateDocumentDto } from './dto/create-document.dto'
import { DocumentsService } from './documents.service'

const UPLOAD_DIR = 'uploads'

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR)
    try {
      fs.mkdirSync(uploadPath, { recursive: true })
    } catch (e) {
      return cb(e as Error, uploadPath)
    }
    cb(null, uploadPath)
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${randomUUID()}_${file.originalname}`
    cb(null, uniqueName)
  },
})

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage }))
  async upload(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
  ) {
    const tenantId = req.tenantId!

    if (!file) {
      throw new BadRequestException('File is required')
    }

    const filePath = path.join(UPLOAD_DIR, file.filename)

    return this.documentsService.createDocument({
      tenantId,
      dto,
      filePath,
      createdById: user.userId,
    })
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.documentsService.getDocument(tenantId, id)
  }
}

