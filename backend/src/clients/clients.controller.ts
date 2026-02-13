import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CreateClientDto } from './dto/create-client.dto'
import { UpdateClientDto } from './dto/update-client.dto'
import { ClientsService } from './clients.service'

@Controller('clients')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateClientDto) {
    const tenantId = req.tenantId!
    return this.clientsService.create(tenantId, dto)
  }

  @Get()
  async list(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.clientsService.findAll(tenantId)
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.clientsService.findOne(tenantId, id)
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const tenantId = req.tenantId!
    return this.clientsService.update(tenantId, id, dto)
  }
}

