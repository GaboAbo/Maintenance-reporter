import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workOrderItem: {
      update: vi.fn(),
    },
    workOrderActivity: {
      create: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  listWorkOrders,
  getWorkOrder,
  createWorkOrder,
  updateWorkOrder,
  updateWorkOrderItem,
  cancelWorkOrder,
} from '@/lib/services/workOrders'

const TENANT = 't1'
const USER = 'u1'

beforeEach(() => vi.clearAllMocks())

describe('listWorkOrders', () => {
  it('queries by tenantId ordered by createdAt desc', async () => {
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    await listWorkOrders(TENANT)
    expect(db.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('applies status filter when provided', async () => {
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    await listWorkOrders(TENANT, { status: 'OPEN' })
    expect(db.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT, status: 'OPEN' }),
      })
    )
  })
})

describe('getWorkOrder', () => {
  it('returns null when not found', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue(null)
    const result = await getWorkOrder(TENANT, 'w1')
    expect(result).toBeNull()
    expect(db.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', tenantId: TENANT } })
    )
  })
})

describe('createWorkOrder', () => {
  it('creates with tenantId, items per assetId, and CREATED activity', async () => {
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    await createWorkOrder(TENANT, USER, {
      type: 'CORRECTIVE',
      assetIds: ['a1', 'a2'],
    })
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          type: 'CORRECTIVE',
          items: { create: [{ assetId: 'a1' }, { assetId: 'a2' }] },
          activities: {
            create: expect.objectContaining({ userId: USER, eventType: 'CREATED' }),
          },
        }),
      })
    )
  })
})

describe('updateWorkOrder', () => {
  it('logs STATUS_CHANGED activity when status changes', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({
      id: 'w1',
      status: 'OPEN',
      assignedToId: null,
    } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'IN_PROGRESS' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    await updateWorkOrder(TENANT, 'w1', USER, { status: 'IN_PROGRESS' })
    expect(db.workOrderActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'STATUS_CHANGED',
          payload: { from: 'OPEN', to: 'IN_PROGRESS' },
        }),
      })
    )
  })

  it('does not log activity when status is not changing', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({
      id: 'w1',
      status: 'OPEN',
      assignedToId: null,
    } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1' } as any)
    await updateWorkOrder(TENANT, 'w1', USER, { priority: 'HIGH' })
    expect(db.workOrderActivity.create).not.toHaveBeenCalled()
  })

  it('throws when not found', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue(null)
    await expect(updateWorkOrder(TENANT, 'missing', USER, {})).rejects.toThrow('Not found')
  })
})

describe('updateWorkOrderItem', () => {
  it('promotes WO to IN_PROGRESS when first item starts', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({
      id: 'w1',
      status: 'OPEN',
      items: [
        { id: 'i1', status: 'open' },
        { id: 'i2', status: 'open' },
      ],
    } as any)
    vi.mocked(db.workOrderItem.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    await updateWorkOrderItem(TENANT, 'w1', 'i1', USER, { status: 'in_progress' })
    expect(db.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'IN_PROGRESS' }),
      })
    )
  })

  it('completes WO when all items are completed', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({
      id: 'w1',
      status: 'IN_PROGRESS',
      items: [
        { id: 'i1', status: 'completed' },
        { id: 'i2', status: 'open' },
      ],
    } as any)
    vi.mocked(db.workOrderItem.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    await updateWorkOrderItem(TENANT, 'w1', 'i2', USER, { status: 'completed' })
    expect(db.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    )
  })

  it('throws when work order not found for tenant', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue(null)
    await expect(
      updateWorkOrderItem(TENANT, 'missing', 'i1', USER, { status: 'in_progress' })
    ).rejects.toThrow('Not found')
  })
})

describe('cancelWorkOrder', () => {
  it('sets status to CANCELLED and logs activity', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN' } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'CANCELLED' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    await cancelWorkOrder(TENANT, 'w1', USER)
    expect(db.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } })
    )
    expect(db.workOrderActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'STATUS_CHANGED',
          payload: { from: 'OPEN', to: 'CANCELLED' },
        }),
      })
    )
  })

  it('throws when not found', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue(null)
    await expect(cancelWorkOrder(TENANT, 'missing', USER)).rejects.toThrow('Not found')
  })
})
