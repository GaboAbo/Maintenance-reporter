import { db } from '@/lib/db'
import type { WorkOrderStatus, WorkOrderType, Priority } from '@prisma/client'

type WorkOrderInput = {
  type: WorkOrderType
  priority?: Priority
  description?: string | null
  assignedToId?: string | null
  dueDate?: Date | null
  linkedScheduleId?: string | null
  assetIds: string[]
}

type WorkOrderUpdate = {
  priority?: Priority
  description?: string | null
  assignedToId?: string | null
  dueDate?: Date | null
  status?: WorkOrderStatus
}

type ItemUpdate = {
  notes?: string | null
  status?: string
}

export async function listWorkOrders(
  tenantId: string,
  filters?: {
    status?: WorkOrderStatus
    type?: WorkOrderType
    assignedToId?: string
  }
) {
  return db.workOrder.findMany({
    where: {
      tenantId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function getWorkOrder(tenantId: string, id: string) {
  return db.workOrder.findFirst({
    where: { id, tenantId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      items: {
        include: { asset: { select: { id: true, name: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true } } },
      },
      linkedSchedule: { select: { id: true, name: true } },
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

export async function createWorkOrder(
  tenantId: string,
  userId: string,
  data: WorkOrderInput
) {
  const { assetIds, ...rest } = data
  await assertAssetsOwnedByTenant(tenantId, assetIds)
  return db.workOrder.create({
    data: {
      ...rest,
      tenantId,
      items: {
        create: assetIds.map((assetId) => ({ assetId })),
      },
      activities: {
        create: {
          userId,
          eventType: 'CREATED',
          payload: {},
        },
      },
    },
  })
}

export async function updateWorkOrder(
  tenantId: string,
  id: string,
  userId: string,
  data: WorkOrderUpdate
) {
  const existing = await db.workOrder.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, assignedToId: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      ...data,
      ...(data.status === 'COMPLETED' && { completedAt: new Date() }),
    },
  })

  if (data.status && data.status !== existing.status) {
    await db.workOrderActivity.create({
      data: {
        workOrderId: id,
        userId,
        eventType: 'STATUS_CHANGED',
        payload: { from: existing.status, to: data.status },
      },
    })
  }

  return updated
}

export async function updateWorkOrderItem(
  tenantId: string,
  workOrderId: string,
  itemId: string,
  userId: string,
  data: ItemUpdate
) {
  const workOrder = await db.workOrder.findFirst({
    where: { id: workOrderId, tenantId },
    include: { items: { select: { id: true, status: true } } },
  })
  if (!workOrder) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  await db.workOrderItem.update({ where: { id: itemId, workOrderId }, data })

  const siblings = await db.workOrderItem.findMany({
    where: { workOrderId },
    select: { id: true, status: true },
  })

  let newWoStatus: WorkOrderStatus | undefined
  if (data.status === 'in_progress' && workOrder.status === 'OPEN') {
    newWoStatus = 'IN_PROGRESS'
  } else if (
    data.status === 'completed' &&
    siblings.every((item) => item.status === 'completed')
  ) {
    newWoStatus = 'COMPLETED'
  }

  if (newWoStatus) {
    await db.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: newWoStatus,
        ...(newWoStatus === 'COMPLETED' && { completedAt: new Date() }),
      },
    })
    await db.workOrderActivity.create({
      data: {
        workOrderId,
        userId,
        eventType: 'STATUS_CHANGED',
        payload: { from: workOrder.status, to: newWoStatus },
      },
    })
  }

  await db.workOrderActivity.create({
    data: {
      workOrderId,
      userId,
      eventType: 'ITEM_UPDATED',
      payload: { itemId, changes: data },
    },
  })

  return db.workOrder.findFirst({
    where: { id: workOrderId },
    include: {
      items: { include: { asset: { select: { id: true, name: true } } } },
    },
  })
}

export async function cancelWorkOrder(
  tenantId: string,
  id: string,
  userId: string
) {
  const existing = await db.workOrder.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  if (existing.status === 'CANCELLED') return existing as any

  const updated = await db.workOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  await db.workOrderActivity.create({
    data: {
      workOrderId: id,
      userId,
      eventType: 'STATUS_CHANGED',
      payload: { from: existing.status, to: 'CANCELLED' },
    },
  })

  return updated
}
