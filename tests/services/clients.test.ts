import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { listClients, createClient, deleteClient, toggleReportRecipient } from '@/lib/services/clients'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listClients', () => {
  it('queries by tenantId', async () => {
    vi.mocked(db.client.findMany).mockResolvedValue([])
    await listClients(TENANT)
    expect(db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } })
    )
  })
})

describe('createClient', () => {
  it('creates and returns new client', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    const client = { id: 'c1', tenantId: TENANT, name: 'Acme Corp', email: 'acme@example.com', receivesReport: false, createdAt: new Date() }
    vi.mocked(db.client.create).mockResolvedValue(client as any)
    const result = await createClient(TENANT, 'Acme Corp', 'acme@example.com')
    expect(result.name).toBe('Acme Corp')
    expect(db.client.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: TENANT, name: 'Acme Corp', email: 'acme@example.com' } })
    )
  })

  it('throws DUPLICATE when email already exists for tenant', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1' } as any)
    await expect(createClient(TENANT, 'Acme', 'acme@example.com')).rejects.toMatchObject({ code: 'DUPLICATE' })
    expect(db.client.create).not.toHaveBeenCalled()
  })
})

describe('deleteClient', () => {
  it('deletes client when no assets assigned', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(0)
    vi.mocked(db.client.delete).mockResolvedValue({} as any)
    await deleteClient(TENANT, 'c1')
    expect(db.client.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('throws NOT_FOUND when client does not exist', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    await expect(deleteClient(TENANT, 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when client belongs to different tenant', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: 'other' } as any)
    await expect(deleteClient(TENANT, 'c1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws IN_USE with count when assets are assigned', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(2)
    const err = await deleteClient(TENANT, 'c1').catch((e) => e)
    expect(err).toMatchObject({ code: 'IN_USE' })
    expect(err.count).toBe(2)
  })
})

describe('toggleReportRecipient', () => {
  it('updates receivesReport flag', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    const updated = { id: 'c1', tenantId: TENANT, name: 'Acme', email: 'a@b.com', receivesReport: true, createdAt: new Date() }
    vi.mocked(db.client.update).mockResolvedValue(updated as any)
    const result = await toggleReportRecipient(TENANT, 'c1', true)
    expect(result.receivesReport).toBe(true)
    expect(db.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { receivesReport: true } })
    )
  })

  it('throws NOT_FOUND when client does not exist', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    await expect(toggleReportRecipient(TENANT, 'x', true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
