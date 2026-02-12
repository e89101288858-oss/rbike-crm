import { Controller, Get, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { JwtUser } from '../common/decorators/current-user.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller()
export class MeController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return {
      userId: user.userId,
      role: user.role,
      franchiseeId: user.franchiseeId,
    }
  }
}
