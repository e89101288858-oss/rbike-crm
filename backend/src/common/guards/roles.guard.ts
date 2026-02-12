import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.get<string[] | undefined>(
      ROLES_KEY,
      context.getHandler(),
    )
    if (!allowedRoles || allowedRoles.length === 0) {
      return true
    }
    const request = context.switchToHttp().getRequest()
    const user = request.user
    if (!user?.role) {
      throw new ForbiddenException()
    }
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException()
    }
    return true
  }
}
