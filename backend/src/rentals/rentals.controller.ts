import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { TenantGuard } from '../common/guards/tenant.guard'
import { CreateRentalDto } from './dto/create-rental.dto'
import { ExtendRentalDto } from './dto/extend-rental.dto'
import { ShortenRentalDto } from './dto/shorten-rental.dto'
import { RentalsService } from './rentals.service'

@Controller('rentals')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Post()
  async create(
    @Req() req: Request,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRentalDto,
  ) {
    const tenantId = req.tenantId!
    return this.rentalsService.create(tenantId, user.userId, dto)
  }

  @Get()
  async list(@Req() req: Request) {
    const tenantId = req.tenantId!
    return this.rentalsService.findAll(tenantId)
  }

  @Get(':id')
  async getOne(@Req() req: Request, @Param('id') id: string) {
    const tenantId = req.tenantId!
    return this.rentalsService.findOne(tenantId, id)
  }

  @Post(':id/extend')
  async extend(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ExtendRentalDto,
  ) {
    const tenantId = req.tenantId!
    return this.rentalsService.extend(tenantId, id, user.userId, dto.days, dto.reason)
  }

  @Post(':id/shorten')
  async shorten(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ShortenRentalDto,
  ) {
    const tenantId = req.tenantId!
    return this.rentalsService.shorten(tenantId, id, user.userId, dto.days, dto.reason)
  }

  @Post(':id/close')
  async close(
    @Req() req: Request,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const tenantId = req.tenantId!
    return this.rentalsService.close(tenantId, id, user.userId)
  }
}
