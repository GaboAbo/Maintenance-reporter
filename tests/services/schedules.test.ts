import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    maintenanceSchedule: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import {
  listSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  toggleScheduleStatus,
  deleteSchedule,
} from '@/lib/services/schedules'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listSchedules', () => {
  it('queries by tenantId ordered by nextDueDate', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    await listSchedules(TENANT)
    expect(db.maintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT },
        orderBy: { nextDueDate: 'asc' },
      })
    )
  })
})

describe('getSchedule', () => {
  it('returns null when not found', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue(null)
    const result = await getSchedule(TENANT, 's1')
    expect(result).toBeNull()
    expect(db.maintenanceSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1', tenantId: TENANT } })
    )
  })

  it('returns schedule when found', async () => {
    const schedule = { id: 's1', tenantId: TENANT, name: 'Monthly PM', assets: [], workOrders: [] }
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue(schedule as any)
    const result = await getSchedule(TENANT, 's1')
    expect(result?.name).toBe('Monthly PM')
    expect(db.maintenanceSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ assets: expect.anything(), workOrders: expect.anything() }),
      })
    )
  })
})

describe('createSchedule', () => {
  it('creates with tenantId and asset junction records', async () => {
    vi.mocked(db.maintenanceSchedule.create).mockResolvedValue({ id: 's1' } as any)
    await createSchedule(TENANT, {
      name: 'Monthly PM',
      triggerType: 'time_based',
      intervalValue: 30,
      intervalUnit: 'days',
      nextDueDate: new Date('2026-05-01'),
      assetIds: ['a1', 'a2'],
    })
    expect(db.maintenanceSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          name: 'Monthly PM',
          assets: {
            create: [{ assetId: 'a1' }, { assetId: 'a2' }],
          },
        }),
      })
    )
  })
})

describe('updateSchedule', () => {
  it('finds then updates scoped to tenantId', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({ id: 's1' } as any)
    await updateSchedule(TENANT, 's1', { name: 'Updated' })
    expect(db.maintenanceSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1', tenantId: TENANT } })
    )
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } })
    )
  })

  it('throws when schedule not found', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue(null)
    await expect(updateSchedule(TENANT, 'missing', { name: 'X' })).rejects.toThrow('Not found')
  })

  it('resets asset associations when assetIds provided', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({ id: 's1' } as any)
    await updateSchedule(TENANT, 's1', { assetIds: ['a3'] })
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assets: { deleteMany: {}, create: [{ assetId: 'a3' }] },
        }),
      })
    )
  })
})

describe('toggleScheduleStatus', () => {
  it('sets active schedule to paused', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue({ id: 's1', status: 'active' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({ id: 's1', status: 'paused' } as any)
    await toggleScheduleStatus(TENANT, 's1')
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'paused' } })
    )
  })

  it('sets paused schedule to active', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue({ id: 's1', status: 'paused' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({ id: 's1', status: 'active' } as any)
    await toggleScheduleStatus(TENANT, 's1')
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active' } })
    )
  })

  it('throws when not found', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue(null)
    await expect(toggleScheduleStatus(TENANT, 'missing')).rejects.toThrow('Not found')
  })
})

describe('deleteSchedule', () => {
  it('finds then deletes scoped to tenantId', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue({ id: 's1' } as any)
    vi.mocked(db.maintenanceSchedule.delete).mockResolvedValue({ id: 's1' } as any)
    await deleteSchedule(TENANT, 's1')
    expect(db.maintenanceSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1', tenantId: TENANT } })
    )
    expect(db.maintenanceSchedule.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } })
    )
  })

  it('throws when not found', async () => {
    vi.mocked(db.maintenanceSchedule.findFirst).mockResolvedValue(null)
    await expect(deleteSchedule(TENANT, 'missing')).rejects.toThrow('Not found')
  })
})
