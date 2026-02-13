import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { Prisma, UserRole } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto, ALLOWED_ROLES } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

@Controller('admin/users')
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

    if (!ALLOWED_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role')
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

    if ((dto.role === 'MANAGER' || dto.role === 'MECHANIC') && dto.franchiseeId) {
      throw new BadRequestException(
        'franchiseeId must not be provided for MANAGER or MECHANIC',
      )
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role as UserRole,
        franchiseeId: dto.role === 'FRANCHISEE' ? dto.franchiseeId! : null,
      },
    })

    const { passwordHash: _, ...rest } = user
    return rest
  }

  @Get()
  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseeId: true,
        isActive: true,
        createdAt: true,
      },
    })
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        franchiseeId: true,
        isActive: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (user.role === 'OWNER') {
      throw new BadRequestException('OWNER user cannot be modified')
    }

    const data: Prisma.UserUpdateInput = {}

    if (dto.role !== undefined) {
      if (!ALLOWED_ROLES.includes(dto.role)) {
        throw new BadRequestException('Invalid role')
      }

      if (dto.role === 'FRANCHISEE') {
        throw new BadRequestException(
          'Changing role to FRANCHISEE is not supported via update',
        )
      }

      data.role = dto.role as UserRole
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive
    }

    if (dto.password !== undefined) {
      data.passwordHash = await bcrypt.hash(dto.password, 10)
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        franchiseeId: true,
        isActive: true,
        createdAt: true,
      },
    })

    return updated
  }
}
