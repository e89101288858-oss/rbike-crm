declare global {
  namespace Express {
    interface Request {
      tenantId?: string
      tenantMode?: 'FRANCHISE' | 'SAAS'
    }
  }
}

export {}
