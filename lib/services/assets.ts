import { db } from '@/lib/db'
import type { AssetStatus } from '@prisma/client'

type AssetInput = {
  name: string
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  location?: string | null
  categoryId?: string | null
  clientId?: string | null
  status?: AssetStatus
  installationDate?: Date | null
  warrantyExpiry?: Date | null
}

export async function listAssets(tenantId: string) {
  return db.asset.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { workOrderItems: true } },
      category: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  })
}

export async function getAsset(tenantId: string, id: string) {
  return db.asset.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      workOrderItems: {
        include: { workOrder: { select: { id: true, type: true, status: true, createdAt: true } } },
        orderBy: { workOrder: { createdAt: 'desc' } },
        take: 10,
      },
      scheduleAssets: {
        include: { schedule: true },
      },
    },
  })
}

export async function createAsset(tenantId: string, data: AssetInput) {
  return db.asset.create({
    data: { ...data, tenantId, status: data.status ?? 'ACTIVE' },
  })
}

export async function updateAsset(tenantId: string, id: string, data: Partial<AssetInput>) {
  const existing = await db.asset.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  return db.asset.update({ where: { id }, data })
}

export async function decommissionAsset(tenantId: string, id: string) {
  const existing = await db.asset.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  return db.asset.update({ where: { id }, data: { status: 'DECOMMISSIONED' } })
}
