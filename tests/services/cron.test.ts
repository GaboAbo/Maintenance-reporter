import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/services/notifications', () => ({
  sendNotification: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const workOrderCreate = vi.fn()
  const workOrderFindMany = vi.fn()
  const scheduleUpdate = vi.fn()
  const scheduleFindMany = vi.fn()
  const userFindMany = vi.fn()

  return {
    db: {
      maintenanceSchedule: {
        findMany: scheduleFindMany,
        update: scheduleUpdate,
      },
      workOrder: {
        create: workOrderCreate,
        findMany: workOrderFindMany,
      },
      user: {
        findMany: userFindMany,
      },
      $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
        fn({
          workOrder: { create: workOrderCreate },
          maintenanceSchedule: { update: scheduleUpdate },
        })
      ),
    },
  }
})

import { db } from '@/lib/db'
import { sendNotification } from '@/lib/services/notifications'
import { runPmCheck } from '@/lib/services/cron'

beforeEach(() => vi.clearAllMocks())

// ─── Existing tests (unchanged) ───────────────────────────────────────────────

describe('runPmCheck', () => {
  it('returns 0 when no schedules are due', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])
    const result = await runPmCheck()
    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('only queries time_based schedules', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])
    await runPmCheck()
    expect(db.maintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ triggerType: 'time_based' }),
      })
    )
  })

  it('creates a PREVENTIVE work order for each due schedule', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    const result = await runPmCheck()

    expect(result).toEqual({ generated: 1 })
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          type: 'PREVENTIVE',
          status: 'OPEN',
          linkedScheduleId: 's1',
          items: { create: [{ assetId: 'a1' }] },
        }),
      })
    )
  })

  it('advances nextDueDate by days interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4)
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('advances nextDueDate by months interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4)
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('skips schedules with no assets', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 7,
        intervalUnit: 'days',
        assets: [],
      },
    ] as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    const result = await runPmCheck()

    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('advances nextDueDate by weeks interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 2,
        intervalUnit: 'weeks',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const expectedNext = new Date(2026, 3, 15)
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: { nextDueDate: expectedNext },
      })
    )
  })

  it('clamps month-end overflow (Jan 31 + 1 month = Feb 28)', async () => {
    const nextDueDate = new Date(2026, 0, 31)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const updateCall = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    const nextDate = (updateCall as any).data.nextDueDate
    expect(nextDate.getMonth()).toBe(1)
    expect(nextDate.getDate()).toBeLessThanOrEqual(28)
  })
})

// ─── Notification tests ────────────────────────────────────────────────────────

describe('runPmCheck — wo.due_soon notifications', () => {
  it('sends wo.due_soon to assigned technician for WOs due within 24h', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany)
      .mockResolvedValueOnce([
        { id: 'w1', assignedToId: 'u1', dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000) },
      ] as any) // due_soon WOs
      .mockResolvedValueOnce([]) // overdue WOs
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u1', 'wo.due_soon', expect.objectContaining({ workOrderId: 'w1' }))
  })
})

describe('runPmCheck — wo.overdue notifications', () => {
  it('sends wo.overdue to assigned technician and tenant admins', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany)
      .mockResolvedValueOnce([]) // due_soon WOs
      .mockResolvedValueOnce([
        { id: 'w2', tenantId: 't1', assignedToId: 'u1', dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      ] as any) // overdue WOs
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any) // tenant admins

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u1', 'wo.overdue', expect.objectContaining({ workOrderId: 'w2' }))
    expect(sendNotification).toHaveBeenCalledWith('u2', 'wo.overdue', expect.objectContaining({ workOrderId: 'w2' }))
  })
})

describe('runPmCheck — schedule.due_soon notifications', () => {
  it('sends schedule.due_soon to tenant admins for schedules due within 24h', async () => {
    vi.mocked(db.maintenanceSchedule.findMany)
      .mockResolvedValueOnce([]) // due schedules (for WO generation)
      .mockResolvedValueOnce([
        { id: 's1', tenantId: 't1', name: 'Monthly HVAC', nextDueDate: new Date(Date.now() + 12 * 60 * 60 * 1000) },
      ] as any) // due_soon schedules
      .mockResolvedValueOnce([]) // overdue schedules
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any)

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u2', 'schedule.due_soon', expect.objectContaining({ scheduleName: 'Monthly HVAC' }))
  })
})

describe('runPmCheck — schedule.overdue notifications', () => {
  it('sends schedule.overdue to tenant admins for overdue active schedules', async () => {
    vi.mocked(db.maintenanceSchedule.findMany)
      .mockResolvedValueOnce([]) // due schedules (for WO generation)
      .mockResolvedValueOnce([]) // due_soon schedules
      .mockResolvedValueOnce([
        { id: 's2', tenantId: 't1', name: 'Quarterly Pump', nextDueDate: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      ] as any) // overdue schedules
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any)

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u2', 'schedule.overdue', expect.objectContaining({ scheduleName: 'Quarterly Pump' }))
  })
})
