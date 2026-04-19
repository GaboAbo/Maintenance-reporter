import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    workOrder: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    maintenanceSchedule: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { getTenantDashboardStats, getTechnicianDashboardStats } from '@/lib/services/reports'

beforeEach(() => vi.clearAllMocks())

// ── getTenantDashboardStats ──────────────────────────────────────────────────

describe('getTenantDashboardStats', () => {
  function setupMocks({
    statusGroups = [],
    typeGroups = [],
    completedWOs = [],
    activeSchedules = 0,
    overdueSchedules = 0,
  }: {
    statusGroups?: Array<{ status: string; _count: { _all: number } }>
    typeGroups?: Array<{ type: string; _count: { _all: number } }>
    completedWOs?: Array<{ createdAt: Date; completedAt: Date | null }>
    activeSchedules?: number
    overdueSchedules?: number
  }) {
    vi.mocked(db.workOrder.groupBy)
      .mockResolvedValueOnce(statusGroups as any)
      .mockResolvedValueOnce(typeGroups as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue(completedWOs as any)
    vi.mocked(db.maintenanceSchedule.count)
      .mockResolvedValueOnce(activeSchedules)
      .mockResolvedValueOnce(overdueSchedules)
  }

  it('returns correct completion rate', async () => {
    setupMocks({
      statusGroups: [
        { status: 'OPEN', _count: { _all: 2 } },
        { status: 'IN_PROGRESS', _count: { _all: 1 } },
        { status: 'COMPLETED', _count: { _all: 2 } },
      ],
    })
    const stats = await getTenantDashboardStats('t1')
    expect(stats.completionRate).toBe(40)
    expect(stats.totalWorkOrders).toBe(5)
  })

  it('returns 0 completion rate when no work orders exist', async () => {
    setupMocks({})
    const stats = await getTenantDashboardStats('t1')
    expect(stats.completionRate).toBe(0)
    expect(stats.totalWorkOrders).toBe(0)
  })

  it('returns correct byStatus counts', async () => {
    setupMocks({
      statusGroups: [
        { status: 'OPEN', _count: { _all: 3 } },
        { status: 'COMPLETED', _count: { _all: 1 } },
      ],
    })
    const stats = await getTenantDashboardStats('t1')
    expect(stats.byStatus).toEqual({ OPEN: 3, IN_PROGRESS: 0, COMPLETED: 1, CANCELLED: 0 })
  })

  it('returns correct byType counts', async () => {
    setupMocks({
      typeGroups: [
        { type: 'PREVENTIVE', _count: { _all: 4 } },
        { type: 'CORRECTIVE', _count: { _all: 2 } },
      ],
    })
    const stats = await getTenantDashboardStats('t1')
    expect(stats.byType).toEqual({ PREVENTIVE: 4, CORRECTIVE: 2 })
  })

  it('returns avg resolution time in hours for completed WOs', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z')
    const t1 = new Date('2026-01-01T10:00:00Z') // 10 hours later
    const t2 = new Date('2026-01-01T00:00:00Z')
    const t3 = new Date('2026-01-01T06:00:00Z') // 6 hours later
    setupMocks({
      completedWOs: [
        { createdAt: t0, completedAt: t1 },
        { createdAt: t2, completedAt: t3 },
      ],
    })
    const stats = await getTenantDashboardStats('t1')
    expect(stats.avgResolutionTimeHours).toBe(8) // avg of 10 and 6
  })

  it('returns null avgResolutionTimeHours when no completed WOs', async () => {
    setupMocks({})
    const stats = await getTenantDashboardStats('t1')
    expect(stats.avgResolutionTimeHours).toBeNull()
  })

  it('returns active and overdue schedule counts', async () => {
    setupMocks({ activeSchedules: 5, overdueSchedules: 2 })
    const stats = await getTenantDashboardStats('t1')
    expect(stats.activeSchedules).toBe(5)
    expect(stats.overdueSchedules).toBe(2)
  })
})

// ── getTechnicianDashboardStats ──────────────────────────────────────────────

describe('getTechnicianDashboardStats', () => {
  function setupMocks({
    statusGroups = [],
    completedWOs = [],
  }: {
    statusGroups?: Array<{ status: string; _count: { _all: number } }>
    completedWOs?: Array<{ createdAt: Date; completedAt: Date | null }>
  }) {
    vi.mocked(db.workOrder.groupBy).mockResolvedValueOnce(statusGroups as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue(completedWOs as any)
  }

  it('returns counts scoped to the given userId', async () => {
    setupMocks({
      statusGroups: [
        { status: 'OPEN', _count: { _all: 1 } },
        { status: 'COMPLETED', _count: { _all: 3 } },
      ],
    })
    const stats = await getTechnicianDashboardStats('t1', 'u1')
    expect(stats.totalAssigned).toBe(4)
    expect(stats.completionRate).toBe(75)
    expect(db.workOrder.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignedToId: 'u1' }) })
    )
  })

  it('returns 0 completion rate when no WOs assigned', async () => {
    setupMocks({})
    const stats = await getTechnicianDashboardStats('t1', 'u1')
    expect(stats.completionRate).toBe(0)
    expect(stats.totalAssigned).toBe(0)
  })

  it('returns null avgResolutionTimeHours when no completed WOs', async () => {
    setupMocks({})
    const stats = await getTechnicianDashboardStats('t1', 'u1')
    expect(stats.avgResolutionTimeHours).toBeNull()
  })

  it('returns correct byStatus counts including zero-count statuses', async () => {
    setupMocks({
      statusGroups: [{ status: 'IN_PROGRESS', _count: { _all: 2 } }],
    })
    const stats = await getTechnicianDashboardStats('t1', 'u1')
    expect(stats.byStatus).toEqual({ OPEN: 0, IN_PROGRESS: 2, COMPLETED: 0, CANCELLED: 0 })
  })
})
