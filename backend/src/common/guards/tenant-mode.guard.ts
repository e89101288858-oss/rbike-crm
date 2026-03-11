import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { TENANT_MODES_KEY } from '../decorators/tenant-modes.decorator'

@Injectable()
export class TenantModeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedModes = this.reflector.getAllAndOverride<Array<'SAAS' | 'FRANCHISE'>>(TENANT_MODES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!allowedModes?.length) return true

    const request = context.switchToHttp().getRequest()
    const mode = request?.tenantMode as 'SAAS' | 'FRANCHISE' | undefined

    if (!mode || !allowedModes.includes(mode)) {
      throw new ForbiddenException('Доступ к разделу запрещен для текущего типа tenant')
    }

    return true
  }
}
