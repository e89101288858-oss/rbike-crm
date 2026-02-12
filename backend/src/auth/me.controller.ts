import { Controller, Get, UseGuards } from '@nestjs/common'
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator'
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
