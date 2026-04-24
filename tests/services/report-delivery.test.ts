import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
    },
    workOrderItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/notifications/resend', () => ({
  sendEmailWithAttachment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/report-generator', () => ({
  generateClientReportPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
}))

import { db } from '@/lib/db'
import { sendEmailWithAttachment } from '@/lib/notifications/resend'
import { generateClientReportPdf } from '@/lib/services/report-generator'
import { sendReportsForTenant, sendAllTenantReports } from '@/lib/services/report-delivery'

const TENANT_ID = 't1'

beforeEach(() => vi.clearAllMocks())

describe('sendReportsForTenant', () => {
  it('returns { sent: 0, skipped: 0 } when tenant not found', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 0, skipped: 0 })
    expect(sendEmailWithAttachment).not.toHaveBeenCalled()
  })

  it('skips clients with no assets', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Hospital', email: 'h@h.com' },
    ] as any)
    vi.mocked(db.asset.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 0, skipped: 1 })
    expect(sendEmailWithAttachment).not.toHaveBeenCalled()
  })

  it('sends email for clients with assets', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Hospital', email: 'h@h.com' },
    ] as any)
    vi.mocked(db.asset.findMany).mockResolvedValue([
      { id: 'a1', name: 'Boiler', category: null, location: null, status: 'ACTIVE' },
    ] as any)
    vi.mocked(db.workOrderItem.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 1, skipped: 0 })
    expect(generateClientReportPdf).toHaveBeenCalledOnce()
    expect(sendEmailWithAttachment).toHaveBeenCalledOnce()
    expect(sendEmailWithAttachment).toHaveBeenCalledWith(
      'h@h.com',
      expect.stringContaining('Acme'),
      expect.any(String),
      expect.objectContaining({ filename: expect.stringContaining('.pdf') })
    )
  })

  it('returns correct counts for mixed clients', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Client A', email: 'a@a.com' },
      { id: 'c2', name: 'Client B', email: 'b@b.com' },
    ] as any)
    vi.mocked(db.asset.findMany)
      .mockResolvedValueOnce([{ id: 'a1', name: 'Boiler', category: null, location: null, status: 'ACTIVE' }] as any)
      .mockResolvedValueOnce([])
    vi.mocked(db.workOrderItem.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 1, skipped: 1 })
  })
})

describe('sendAllTenantReports', () => {
  it('calls sendReportsForTenant for each tenant', async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([{ id: 't1' }, { id: 't2' }] as any)
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    vi.mocked(db.client.findMany).mockResolvedValue([])
    await sendAllTenantReports()
    expect(db.tenant.findUnique).toHaveBeenCalledTimes(2)
  })
})
