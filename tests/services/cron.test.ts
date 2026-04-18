import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const workOrderCreate = vi.fn()
  const scheduleUpdate = vi.fn()
  const scheduleFindMany = vi.fn()

  return {
    db: {
      maintenanceSchedule: {
        findMany: scheduleFindMany,
        update: scheduleUpdate,
      },
      workOrder: {
        create: workOrderCreate,
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
import { runPmCheck } from '@/lib/services/cron'

beforeEach(() => vi.clearAllMocks())

describe('runPmCheck', () => {
  it('returns 0 when no schedules are due', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    const result = await runPmCheck()
    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('creates a PREVENTIVE work order for each due schedule', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)

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
    const nextDueDate = new Date(2026, 3, 1) // April 1st, 2026
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        nextDueDate,
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4) // May is 0-indexed, so 4 = May
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('advances nextDueDate by months interval', async () => {
    const nextDueDate = new Date(2026, 3, 1) // April 1st, 2026
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4) // May is 0-indexed, so 4 = May
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('skips schedules with no assets', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 7,
        intervalUnit: 'days',
        assets: [],
      },
    ] as any)

    const result = await runPmCheck()

    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('clamps month-end overflow (Jan 31 + 1 month = Feb 28)', async () => {
    const nextDueDate = new Date('2026-01-31T00:00:00.000Z')
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)

    await runPmCheck()

    const updateCall = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    const nextDate = (updateCall as any).data.nextDueDate
    expect(nextDate.getMonth()).toBe(1)  // February (0-indexed)
    expect(nextDate.getDate()).toBeLessThanOrEqual(28)  // Feb has max 28/29 days
  })
})
