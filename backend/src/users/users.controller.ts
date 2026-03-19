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
  Delete,
  Query,
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

  @Get('search')
  async search(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = Math.max(1, Number(page || 1))
    const sizeNum = Math.max(1, Math.min(100, Number(pageSize || 20)))

    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(role ? { role: role as UserRole } : {}),
      ...(isActive === 'true' ? { isActive: true } : {}),
      ...(isActive === 'false' ? { isActive: false } : {}),
      ...(tenantId ? { userTenants: { some: { tenantId } } } : {}),
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
        select: {
          id: true,
          email: true,
          role: true,
          franchiseeId: true,
          isActive: true,
          createdAt: true,
          fullName: true,
          phone: true,
          userTenants: { select: { tenantId: true } },
        },
      }),
    ])

    return {
      items,
      page: pageNum,
      pageSize: sizeNum,
      total,
      totalPages: Math.max(1, Math.ceil(total / sizeNum)),
    }
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

    const data: Prisma.UserUncheckedUpdateInput = {}

    const targetRole = dto.role ?? user.role

    if (!ALLOWED_ROLES.includes(targetRole as any)) {
      throw new BadRequestException('Invalid role')
    }

    if (targetRole === 'FRANCHISEE') {
      const franchiseeId = dto.franchiseeId ?? user.franchiseeId
      if (!franchiseeId) {
        throw new BadRequestException('franchiseeId is required for FRANCHISEE')
      }
      const franchisee = await this.prisma.franchisee.findUnique({ where: { id: franchiseeId } })
      if (!franchisee) throw new BadRequestException('Franchisee not found')
      data.franchiseeId = franchiseeId
    } else {
      if (dto.franchiseeId) {
        throw new BadRequestException('franchiseeId can be set only for FRANCHISEE')
      }
      data.franchiseeId = null
    }

    if (dto.role !== undefined) {
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

  @Post(':id/reset-sessions')
  async resetSessions(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, tokenVersion: true } })
    if (!user) throw new NotFoundException('User not found')
    if (user.role === 'OWNER') throw new BadRequestException('OWNER user cannot be modified')

    const updated = await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    })

    return { ok: true, ...updated }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!user) throw new NotFoundException('User not found')
    if (user.role === 'OWNER') throw new BadRequestException('OWNER user cannot be deleted')

    await this.prisma.$transaction(async (tx) => {
      await tx.userTenant.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    return { id, deleted: true }
  }
}
