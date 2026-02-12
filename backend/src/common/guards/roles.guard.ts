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
      const allowedRoles = this.reflector.getAllAndOverride<string[] | undefined>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      )
  
      if (!allowedRoles || allowedRoles.length === 0) {
        return true
      }
  
      const request = context.switchToHttp().getRequest()
      const user = request.user
  
      if (!user?.role) {
        throw new ForbiddenException('Forbidden')
      }
  
      if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenException('Forbidden')
      }
  
      return true
    }
  }