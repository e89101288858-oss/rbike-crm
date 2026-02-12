import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export type JwtUser = {
  userId: string
  role: string
  franchiseeId: string | null
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
  },
)
