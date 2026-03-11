import { BadRequestException } from '@nestjs/common'
import { SaasBillingService } from './saas-billing.service'

describe('SaasBillingService webhook', () => {
  const makeConfig = () => ({
    get: jest.fn((key: string) => {
      if (key === 'YOOKASSA_SHOP_ID') return 'shop'
      if (key === 'YOOKASSA_SECRET_KEY') return 'secret'
      return undefined
    }),
  })

  const makePrisma = () => {
    const tx = {
      saaSInvoice: {
        findUnique: jest.fn().mockResolvedValue({ status: 'PENDING' }),
        update: jest.fn().mockResolvedValue({}),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ saasPaidUntil: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    const prisma = {
      saaSInvoice: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb: (arg: any) => Promise<void>) => cb(tx)),
      __tx: tx,
    }

    return prisma
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(global as any).fetch = jest.fn()
  })

  it('marks invoice as PAID for succeeded payment (idempotent-safe path)', async () => {
    const prisma = makePrisma()
    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      tenantId: 't-1',
      plan: 'STARTER',
      durationMonths: 1,
      amountRub: 1,
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay-1',
        status: 'succeeded',
        amount: { value: '1.00' },
        metadata: { invoiceId: 'inv-1' },
      }),
    })

    const service = new SaasBillingService(prisma as any, makeConfig() as any)
    const result = await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'pay-1' } })

    expect(result).toEqual({ ok: true })
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.saaSInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    )
  })

  it('marks invoice as CANCELED for canceled payment', async () => {
    const prisma = makePrisma()
    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'inv-2',
      tenantId: 't-2',
      plan: 'PRO',
      durationMonths: 3,
      amountRub: 14970,
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay-2',
        status: 'canceled',
        amount: { value: '14970.00' },
      }),
    })

    const service = new SaasBillingService(prisma as any, makeConfig() as any)
    await service.handleWebhook({ event: 'payment.canceled', object: { id: 'pay-2' } })

    expect(prisma.saaSInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-2' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    )
  })

  it('is idempotent for repeated succeeded webhook (no duplicate paid transition)', async () => {
    const prisma = makePrisma()
    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'inv-4',
      tenantId: 't-4',
      plan: 'STARTER',
      durationMonths: 1,
      amountRub: 1,
    })

    prisma.__tx.saaSInvoice.findUnique.mockResolvedValue({ status: 'PAID' })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay-4',
        status: 'succeeded',
        amount: { value: '1.00' },
      }),
    })

    const service = new SaasBillingService(prisma as any, makeConfig() as any)
    await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'pay-4' } })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(prisma.__tx.saaSInvoice.update).not.toHaveBeenCalled()
    expect(prisma.__tx.tenant.update).not.toHaveBeenCalled()
  })

  it('throws on amount mismatch', async () => {
    const prisma = makePrisma()
    prisma.saaSInvoice.findFirst.mockResolvedValue({
      id: 'inv-3',
      tenantId: 't-3',
      plan: 'STARTER',
      durationMonths: 1,
      amountRub: 1,
    })

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay-3',
        status: 'succeeded',
        amount: { value: '99.00' },
      }),
    })

    const service = new SaasBillingService(prisma as any, makeConfig() as any)

    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'pay-3' } })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
