import { db } from '@/lib/db'

type ScheduleStatus = 'active' | 'paused'

type ScheduleInput = {
  name: string
  triggerType: 'time_based' | 'usage_based'
  intervalValue: number
  intervalUnit?: 'days' | 'weeks' | 'months' | null
  nextDueDate: Date
  assetIds: string[]
}

export async function listSchedules(tenantId: string) {
  return db.maintenanceSchedule.findMany({
    where: { tenantId },
    orderBy: { nextDueDate: 'asc' },
    include: {
      assets: {
        include: { asset: { select: { id: true, name: true } } },
      },
      _count: { select: { workOrders: true } },
    },
  })
}

export async function getSchedule(tenantId: string, id: string) {
  return db.maintenanceSchedule.findFirst({
    where: { id, tenantId },
    include: {
      assets: {
        include: { asset: true },
      },
      workOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, status: true, type: true, createdAt: true },
      },
    },
  })
}

async function assertAssetsOwnedByTenant(tenantId: string, assetIds: string[]): Promise<void> {
  const owned = await db.asset.findMany({
    where: { id: { in: assetIds }, tenantId },
    select: { id: true },
  })
  if (owned.length !== assetIds.length) {
    throw Object.assign(new Error('One or more assets not found'), { code: 'P2025' })
  }
}

export async function createSchedule(tenantId: string, data: ScheduleInput) {
  const { assetIds, ...rest } = data
  await assertAssetsOwnedByTenant(tenantId, assetIds)
  return db.maintenanceSchedule.create({
    data: {
      ...rest,
      tenantId,
      assets: {
        create: assetIds.map((assetId) => ({ assetId })),
      },
    },
  })
}

export async function updateSchedule(
  tenantId: string,
  id: string,
  data: Partial<ScheduleInput>
) {
  const existing = await db.maintenanceSchedule.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  const { assetIds, ...rest } = data

  if (assetIds !== undefined) {
    await assertAssetsOwnedByTenant(tenantId, assetIds)
  }

  return db.maintenanceSchedule.update({
    where: { id },
    data: {
      ...rest,
      ...(assetIds !== undefined && {
        assets: {
          deleteMany: {},
          create: assetIds.map((assetId) => ({ assetId })),
        },
      }),
    },
  })
}

export async function toggleScheduleStatus(tenantId: string, id: string) {
  const existing = await db.maintenanceSchedule.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  const newStatus: ScheduleStatus = existing.status === 'active' ? 'paused' : 'active'
  return db.maintenanceSchedule.update({
    where: { id },
    data: { status: newStatus },
  })
}

export async function deleteSchedule(tenantId: string, id: string) {
  const existing = await db.maintenanceSchedule.findFirst({
    where: { id, tenantId },
    select: { id: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  return db.maintenanceSchedule.delete({ where: { id } })
}
