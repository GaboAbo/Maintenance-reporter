import { db } from '@/lib/db'

export type CategoryEntry = {
  id: string
  name: string
  isSystem: boolean
  tenantId: string | null
}

export async function listCategories(tenantId: string): Promise<CategoryEntry[]> {
  return db.assetCategory.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isSystem: true, tenantId: true },
  })
}

export async function createCategory(tenantId: string, name: string): Promise<CategoryEntry> {
  const existing = await db.assetCategory.findFirst({ where: { tenantId, name } })
  if (existing) throw Object.assign(new Error('A category with this name already exists'), { code: 'DUPLICATE' })
  return db.assetCategory.create({
    data: { tenantId, name, isSystem: false },
    select: { id: true, name: true, isSystem: true, tenantId: true },
  })
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const category = await db.assetCategory.findFirst({
    where: { id: categoryId },
    select: { id: true, isSystem: true, tenantId: true },
  })

  if (!category) throw Object.assign(new Error('Category not found'), { code: 'NOT_FOUND' })
  if (category.isSystem) throw Object.assign(new Error('System categories cannot be deleted'), { code: 'FORBIDDEN' })
  if (category.tenantId !== tenantId) throw Object.assign(new Error('Category not found'), { code: 'NOT_FOUND' })

  const assetCount = await db.asset.count({ where: { categoryId } })
  if (assetCount > 0) {
    throw Object.assign(
      new Error(`Category is assigned to ${assetCount} asset(s)`),
      { code: 'IN_USE', count: assetCount }
    )
  }

  await db.assetCategory.delete({ where: { id: categoryId } })
}
