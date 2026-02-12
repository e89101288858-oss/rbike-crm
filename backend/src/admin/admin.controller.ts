import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFranchiseeDto } from './dto/create-franchisee.dto'
import { UpdateFranchiseeDto } from './dto/update-franchisee.dto'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto } from './dto/update-tenant.dto'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('franchisees')
  async createFranchisee(@Body() dto: CreateFranchiseeDto) {
    return this.prisma.franchisee.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    })
  }

  @Get('franchisees')
  async listFranchisees() {
    return this.prisma.franchisee.findMany({
      include: { tenants: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Get('franchisees/:id')
  async getFranchisee(@Param('id') id: string) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id },
      include: { tenants: true },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return franchisee
  }

  @Patch('franchisees/:id')
  async updateFranchisee(
    @Param('id') id: string,
    @Body() dto: UpdateFranchiseeDto,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.franchisee.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  @Post('franchisees/:franchiseeId/tenants')
  async createTenant(
    @Param('franchiseeId') franchiseeId: string,
    @Body() dto: CreateTenantDto,
  ) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.tenant.create({
      data: {
        franchiseeId,
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    })
  }

  @Get('franchisees/:franchiseeId/tenants')
  async listTenants(@Param('franchiseeId') franchiseeId: string) {
    const franchisee = await this.prisma.franchisee.findUnique({
      where: { id: franchiseeId },
    })
    if (!franchisee) {
      throw new NotFoundException('Franchisee not found')
    }
    return this.prisma.tenant.findMany({
      where: { franchiseeId },
      orderBy: { createdAt: 'asc' },
    })
  }

  @Patch('tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    })
    if (!tenant) {
      throw new NotFoundException('Tenant not found')
    }
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }
}
