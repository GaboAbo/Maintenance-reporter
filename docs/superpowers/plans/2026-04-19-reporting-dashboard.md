# Reporting/Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard stub with a live metrics page showing tenant-wide work order and schedule stats for admins/managers, and personal work order stats for all users.

**Architecture:** A new `lib/services/reports.ts` service computes all metrics via Prisma queries and is called from an async server component at `app/(dashboard)/dashboard/page.tsx`. Three presentational components in `components/dashboard/` render the data.

**Tech Stack:** Next.js App Router (async server components), Prisma ORM, TypeScript, Vitest, Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/services/reports.ts` | Create | Prisma queries + metric computation |
| `tests/services/reports.test.ts` | Create | Unit tests for both service functions |
| `components/dashboard/StatCard.tsx` | Create | Reusable single-metric card |
| `components/dashboard/TenantStats.tsx` | Create | Tenant-wide stats section |
| `components/dashboard/TechnicianStats.tsx` | Create | Personal stats section |
| `app/(dashboard)/dashboard/page.tsx` | Modify | Replace stub with async server component |

---

## Task 1: Reporting service

**Files:**
- Create: `lib/services/reports.ts`
- Create: `tests/services/reports.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/reports.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/services/reports.test.ts
```

Expected: FAIL — `getTenantDashboardStats` and `getTechnicianDashboardStats` not found.

- [ ] **Step 3: Create the service**

Create `lib/services/reports.ts`:

```typescript
import { db } from '@/lib/db'
import type { WorkOrderStatus, WorkOrderType } from '@prisma/client'

export type TenantDashboardStats = {
  completionRate: number
  totalWorkOrders: number
  byStatus: Record<WorkOrderStatus, number>
  byType: Record<WorkOrderType, number>
  avgResolutionTimeHours: number | null
  activeSchedules: number
  overdueSchedules: number
}

export type TechnicianDashboardStats = {
  totalAssigned: number
  byStatus: Record<WorkOrderStatus, number>
  completionRate: number
  avgResolutionTimeHours: number | null
}

function computeAvgResolutionHours(
  wos: Array<{ createdAt: Date; completedAt: Date | null }>
): number | null {
  if (wos.length === 0) return null
  const totalMs = wos.reduce((sum, wo) => sum + (wo.completedAt!.getTime() - wo.createdAt.getTime()), 0)
  return Math.round((totalMs / wos.length / 3_600_000) * 10) / 10
}

function emptyByStatus(): Record<WorkOrderStatus, number> {
  return { OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }
}

export async function getTenantDashboardStats(tenantId: string): Promise<TenantDashboardStats> {
  const [statusGroups, typeGroups, completedWOs, activeSchedules, overdueSchedules] =
    await Promise.all([
      db.workOrder.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      db.workOrder.groupBy({
        by: ['type'],
        where: { tenantId },
        _count: { _all: true },
      }),
      db.workOrder.findMany({
        where: { tenantId, status: 'COMPLETED', completedAt: { not: null } },
        select: { createdAt: true, completedAt: true },
      }),
      db.maintenanceSchedule.count({
        where: { tenantId, status: 'active' },
      }),
      db.maintenanceSchedule.count({
        where: { tenantId, status: 'active', nextDueDate: { lt: new Date() } },
      }),
    ])

  const byStatus = emptyByStatus()
  for (const g of statusGroups) byStatus[g.status as WorkOrderStatus] += g._count._all

  const byType: Record<WorkOrderType, number> = { PREVENTIVE: 0, CORRECTIVE: 0 }
  for (const g of typeGroups) byType[g.type as WorkOrderType] += g._count._all

  const totalWorkOrders = Object.values(byStatus).reduce((a, b) => a + b, 0)
  const completionRate =
    totalWorkOrders === 0 ? 0 : Math.round((byStatus.COMPLETED / totalWorkOrders) * 1000) / 10

  return {
    completionRate,
    totalWorkOrders,
    byStatus,
    byType,
    avgResolutionTimeHours: computeAvgResolutionHours(completedWOs),
    activeSchedules,
    overdueSchedules,
  }
}

export async function getTechnicianDashboardStats(
  tenantId: string,
  userId: string
): Promise<TechnicianDashboardStats> {
  const [statusGroups, completedWOs] = await Promise.all([
    db.workOrder.groupBy({
      by: ['status'],
      where: { tenantId, assignedToId: userId },
      _count: { _all: true },
    }),
    db.workOrder.findMany({
      where: { tenantId, assignedToId: userId, status: 'COMPLETED', completedAt: { not: null } },
      select: { createdAt: true, completedAt: true },
    }),
  ])

  const byStatus = emptyByStatus()
  for (const g of statusGroups) byStatus[g.status as WorkOrderStatus] += g._count._all

  const totalAssigned = Object.values(byStatus).reduce((a, b) => a + b, 0)
  const completionRate =
    totalAssigned === 0 ? 0 : Math.round((byStatus.COMPLETED / totalAssigned) * 1000) / 10

  return {
    totalAssigned,
    byStatus,
    completionRate,
    avgResolutionTimeHours: computeAvgResolutionHours(completedWOs),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/reports.test.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/reports.ts tests/services/reports.test.ts
git commit -m "feat: add reporting service with tenant and technician dashboard stats"
```

---

## Task 2: StatCard component

**Files:**
- Create: `components/dashboard/StatCard.tsx`

- [ ] **Step 1: Create StatCard**

```tsx
type Props = {
  title: string
  value: string | number
  subtitle?: string
}

export function StatCard({ title, value, subtitle }: Props) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/StatCard.tsx
git commit -m "feat: add StatCard dashboard component"
```

---

## Task 3: TenantStats and TechnicianStats components

**Files:**
- Create: `components/dashboard/TenantStats.tsx`
- Create: `components/dashboard/TechnicianStats.tsx`

- [ ] **Step 1: Create TenantStats**

Create `components/dashboard/TenantStats.tsx`:

```tsx
import { StatCard } from './StatCard'
import type { TenantDashboardStats } from '@/lib/services/reports'

type Props = {
  stats: TenantDashboardStats
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export function TenantStats({ stats }: Props) {
  const resolutionTime =
    stats.avgResolutionTimeHours !== null ? `${stats.avgResolutionTimeHours} hrs` : '—'

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="Completion rate"
          value={`${stats.completionRate}%`}
          subtitle={`of ${stats.totalWorkOrders} total`}
        />
        <StatCard title="Avg resolution time" value={resolutionTime} />
        <StatCard title="Active schedules" value={stats.activeSchedules} />
        <StatCard title="Overdue schedules" value={stats.overdueSchedules} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
                <tr key={status} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-700">{STATUS_LABELS[status]}</td>
                  <td className="px-4 py-3 text-right">{stats.byStatus[status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-md border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Type</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(['PREVENTIVE', 'CORRECTIVE'] as const).map((type) => (
                <tr key={type} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-700 capitalize">{type.toLowerCase()}</td>
                  <td className="px-4 py-3 text-right">{stats.byType[type]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create TechnicianStats**

Create `components/dashboard/TechnicianStats.tsx`:

```tsx
import { StatCard } from './StatCard'
import type { TechnicianDashboardStats } from '@/lib/services/reports'

type Props = {
  stats: TechnicianDashboardStats
  heading?: string
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export function TechnicianStats({ stats, heading = 'Your Stats' }: Props) {
  const resolutionTime =
    stats.avgResolutionTimeHours !== null ? `${stats.avgResolutionTimeHours} hrs` : '—'
  const openCount = stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-medium">{heading}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Assigned work orders"
          value={stats.totalAssigned}
          subtitle={`${openCount} open`}
        />
        <StatCard
          title="Completion rate"
          value={`${stats.completionRate}%`}
          subtitle={`of ${stats.totalAssigned} total`}
        />
        <StatCard title="Avg resolution time" value={resolutionTime} />
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-700">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
              <tr key={status} className="hover:bg-zinc-50">
                <td className="px-4 py-3 text-zinc-700">{STATUS_LABELS[status]}</td>
                <td className="px-4 py-3 text-right">{stats.byStatus[status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/TenantStats.tsx components/dashboard/TechnicianStats.tsx
git commit -m "feat: add TenantStats and TechnicianStats dashboard components"
```

---

## Task 4: Dashboard page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Replace the stub**

Replace the entire contents of `app/(dashboard)/dashboard/page.tsx` with:

```tsx
import { getSessionUser } from '@/lib/tenant'
import { getTenantDashboardStats, getTechnicianDashboardStats } from '@/lib/services/reports'
import { TenantStats } from '@/components/dashboard/TenantStats'
import { TechnicianStats } from '@/components/dashboard/TechnicianStats'

export default async function DashboardPage() {
  const user = await getSessionUser()
  const isManager = user.role === 'ADMIN' || user.role === 'MANAGER'

  const [tenantStats, techStats] = await Promise.all([
    isManager ? getTenantDashboardStats(user.tenantId) : Promise.resolve(null),
    getTechnicianDashboardStats(user.tenantId, user.id),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      {isManager && tenantStats && (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">Team Overview</h2>
          <TenantStats stats={tenantStats} />
        </section>
      )}

      <section>
        <TechnicianStats stats={techStats} heading="Your Stats" />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite to verify no regressions**

```bash
npm test
```

Expected: All existing tests pass (79+) plus the 10 new reports tests.

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: replace dashboard stub with live metrics page"
```
