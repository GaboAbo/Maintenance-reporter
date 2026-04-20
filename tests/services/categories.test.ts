import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    assetCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { listCategories, createCategory, deleteCategory } from '@/lib/services/categories'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listCategories', () => {
  it('queries system and tenant categories', async () => {
    vi.mocked(db.assetCategory.findMany).mockResolvedValue([])
    await listCategories(TENANT)
    expect(db.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ tenantId: null }, { tenantId: TENANT }] },
      })
    )
  })

  it('returns system and tenant categories together', async () => {
    const cats = [
      { id: 's1', name: 'HVAC', isSystem: true, tenantId: null },
      { id: 'c1', name: 'Custom', isSystem: false, tenantId: TENANT },
    ]
    vi.mocked(db.assetCategory.findMany).mockResolvedValue(cats as any)
    const result = await listCategories(TENANT)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('HVAC')
    expect(result[1].name).toBe('Custom')
  })
})

describe('createCategory', () => {
  it('creates and returns new category', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue(null)
    const cat = { id: 'c2', name: 'My Cat', isSystem: false, tenantId: TENANT }
    vi.mocked(db.assetCategory.create).mockResolvedValue(cat as any)
    const result = await createCategory(TENANT, 'My Cat')
    expect(result.name).toBe('My Cat')
    expect(db.assetCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenantId: TENANT, name: 'My Cat', isSystem: false },
      })
    )
  })

  it('throws DUPLICATE error when name already exists for tenant', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1' } as any)
    await expect(createCategory(TENANT, 'HVAC')).rejects.toMatchObject({ code: 'DUPLICATE' })
    expect(db.assetCategory.create).not.toHaveBeenCalled()
  })
})

describe('deleteCategory', () => {
  it('deletes category when no assets use it', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(0)
    vi.mocked(db.assetCategory.delete).mockResolvedValue({} as any)
    await deleteCategory(TENANT, 'c1')
    expect(db.assetCategory.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('throws NOT_FOUND when category does not exist', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue(null)
    await expect(deleteCategory(TENANT, 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when category belongs to different tenant', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: 'other' } as any)
    await expect(deleteCategory(TENANT, 'c1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws FORBIDDEN when attempting to delete a system category', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 's1', isSystem: true, tenantId: null } as any)
    await expect(deleteCategory(TENANT, 's1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(db.asset.count).not.toHaveBeenCalled()
  })

  it('throws IN_USE with count when assets are assigned', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(3)
    const err = await deleteCategory(TENANT, 'c1').catch((e) => e)
    expect(err).toMatchObject({ code: 'IN_USE' })
    expect(err.message).toContain('3')
  })
})
