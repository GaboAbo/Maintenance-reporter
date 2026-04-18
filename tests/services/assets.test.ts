import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    asset: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { listAssets, getAsset, createAsset, updateAsset } from '@/lib/services/assets'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listAssets', () => {
  it('queries by tenantId', async () => {
    vi.mocked(db.asset.findMany).mockResolvedValue([])
    await listAssets(TENANT)
    expect(db.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } })
    )
  })
})

describe('getAsset', () => {
  it('returns null for asset belonging to different tenant', async () => {
    vi.mocked(db.asset.findFirst).mockResolvedValue(null)
    const result = await getAsset(TENANT, 'a1')
    expect(result).toBeNull()
    expect(db.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', tenantId: TENANT } })
    )
  })

  it('returns asset when found', async () => {
    const asset = { id: 'a1', tenantId: TENANT, name: 'Pump A' }
    vi.mocked(db.asset.findFirst).mockResolvedValue(asset as any)
    const result = await getAsset(TENANT, 'a1')
    expect(result?.name).toBe('Pump A')
  })
})

describe('createAsset', () => {
  it('creates asset with tenantId', async () => {
    vi.mocked(db.asset.create).mockResolvedValue({ id: 'a2', tenantId: TENANT, name: 'Pump B' } as any)
    const result = await createAsset(TENANT, { name: 'Pump B', status: 'ACTIVE' })
    expect(db.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT, name: 'Pump B' }) })
    )
    expect(result.name).toBe('Pump B')
  })
})

describe('updateAsset', () => {
  it('scopes update to tenantId', async () => {
    vi.mocked(db.asset.update).mockResolvedValue({ id: 'a1', name: 'Updated' } as any)
    await updateAsset(TENANT, 'a1', { name: 'Updated' })
    expect(db.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1', tenantId: TENANT } })
    )
  })
})
