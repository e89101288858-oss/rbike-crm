import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    })
    if (existing) {
      throw new ConflictException('Email already in use')
    }

    if (dto.role === 'FRANCHISEE') {
      if (!dto.franchiseeId) {
        throw new BadRequestException('franchiseeId is required for FRANCHISEE')
      }
      const franchisee = await this.prisma.franchisee.findUnique({
        where: { id: dto.franchiseeId },
      })
      if (!franchisee) {
        throw new BadRequestException('Franchisee not found')
      }
    }

    if (dto.role === 'MANAGER' || dto.role === 'MECHANIC') {
      if (!dto.tenantIds || dto.tenantIds.length === 0) {
        throw new BadRequestException(
          'tenantIds is required for MANAGER and MECHANIC',
        )
      }
      const tenants = await this.prisma.tenant.findMany({
        where: { id: { in: dto.tenantIds } },
      })
      if (tenants.length !== dto.tenantIds.length) {
        throw new BadRequestException('One or more tenant ids are invalid')
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    if (dto.role === 'FRANCHISEE') {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role,
          franchiseeId: dto.franchiseeId!,
        },
      })
      const { passwordHash: _, ...rest } = user
      return rest
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role,
          franchiseeId: null,
        },
      })
      await tx.userTenant.createMany({
        data: dto.tenantIds!.map((tenantId) => ({
          userId: u.id,
          tenantId,
        })),
      })
      return u
    })

    const { passwordHash: _, ...rest } = user
    return rest
  }
}
