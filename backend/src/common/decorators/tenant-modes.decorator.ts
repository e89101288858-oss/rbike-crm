import { SetMetadata } from '@nestjs/common'

export const TENANT_MODES_KEY = 'tenant_modes'

export const TenantModes = (...modes: Array<'SAAS' | 'FRANCHISE'>) => SetMetadata(TENANT_MODES_KEY, modes)
