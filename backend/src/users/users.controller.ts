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
        role: dto.role,
        franchiseeId: dto.role === 'FRANCHISEE' ? dto.franchiseeId! : null,
      },
    })

    const { passwordHash: _, ...rest } = user
    return rest
  }

  @Get()
  async list() {
    const users = await this.prisma.user.findMany({
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

    return users
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

    const data: {
      role?: string
      franchiseeId?: string | null
      isActive?: boolean
      passwordHash?: string
    } = {}

    if (dto.role !== undefined) {
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
        data.franchiseeId = dto.franchiseeId
      } else {
        if (dto.franchiseeId) {
          throw new BadRequestException(
            'franchiseeId must not be provided for MANAGER or MECHANIC',
          )
        }
        data.franchiseeId = null
      }

      data.role = dto.role
    } else if (dto.franchiseeId !== undefined) {
      throw new BadRequestException(
        'franchiseeId can only be updated together with role change',
      )
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive
    }

    if (dto.password !== undefined) {
      const passwordHash = await bcrypt.hash(dto.password, 10)
      data.passwordHash = passwordHash
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
    })

    const { passwordHash: _, ...rest } = updated
    return rest
  }
}
