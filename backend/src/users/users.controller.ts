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
    isActive?: boolean
    passwordHash?: string
  } = {}

  if (dto.role !== undefined) {
    if (!ALLOWED_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role')
    }

    // Запрещаем изменение роли на FRANCHISEE через update
    if (dto.role === 'FRANCHISEE') {
      throw new BadRequestException(
        'Changing role to FRANCHISEE is not supported via update',
      )
    }

    data.role = dto.role
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
