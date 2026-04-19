# Plan 4 — Reporting/Dashboard Design

**Date:** 2026-04-19  
**Scope:** Work order and schedule metrics dashboard for managers and technicians, with tenant-wide and personal stat views.

---

## 1. Audience & Scope

| Audience | View |
|---|---|
| ADMIN / MANAGER | Tenant-wide stats + their own personal stats |
| TECHNICIAN | Personal stats only |

No time-range filtering — fixed view over all historical data.  
No asset-level reporting — purely work order and schedule metrics.

---

## 2. Architecture

### New Files

**`lib/services/reports.ts`**  
Two exported functions:

- `getTenantDashboardStats(tenantId: string): Promise<TenantDashboardStats>`
- `getTechnicianDashboardStats(tenantId: string, userId: string): Promise<TechnicianDashboardStats>`

All Prisma queries live here. Avg resolution time is computed in JS from a `findMany` returning only `createdAt` and `completedAt` for COMPLETED WOs. Returns `null` if no completed WOs exist.

**`components/dashboard/StatCard.tsx`**  
Reusable presentational component. Props: `title: string`, `value: string | number`, `subtitle?: string`.

**`components/dashboard/TenantStats.tsx`**  
Renders the tenant-wide section: 4 stat cards + WO breakdown table.

**`components/dashboard/TechnicianStats.tsx`**  
Renders the personal section: 3 stat cards + personal WO status breakdown table.

### Modified Files

**`app/(dashboard)/dashboard/page.tsx`**  
Replaced with an async server component. Calls `getSessionUser`, then:
- ADMIN/MANAGER: calls both service functions, renders `<TenantStats>` then `<TechnicianStats>` (labelled "Your Stats")
- TECHNICIAN: calls only `getTechnicianDashboardStats`, renders `<TechnicianStats>`

### New Test File

**`tests/services/reports.test.ts`**

---

## 3. Metrics

### `getTenantDashboardStats`

Returns `TenantDashboardStats`:

```ts
type TenantDashboardStats = {
  completionRate: number          // 0–100, percentage
  totalWorkOrders: number
  byStatus: {
    OPEN: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELLED: number
  }
  byType: {
    PREVENTIVE: number
    CORRECTIVE: number
  }
  avgResolutionTimeHours: number | null
  activeSchedules: number
  overdueSchedules: number        // nextDueDate < now, status = "active"
}
```

**completionRate:** `(COMPLETED / total) * 100`, rounded to 1 decimal. Returns `0` if total is 0.  
**avgResolutionTimeHours:** `findMany` on COMPLETED WOs selecting `{ createdAt, completedAt }`, compute average of `(completedAt - createdAt)` in ms, convert to hours. Returns `null` if array is empty.  
**overdueSchedules:** `count` where `nextDueDate < new Date()` and `status = "active"`.

### `getTechnicianDashboardStats`

Returns `TechnicianDashboardStats`:

```ts
type TechnicianDashboardStats = {
  totalAssigned: number
  byStatus: {
    OPEN: number
    IN_PROGRESS: number
    COMPLETED: number
    CANCELLED: number
  }
  completionRate: number          // 0–100
  avgResolutionTimeHours: number | null
}
```

Same computation logic as tenant stats, but all queries filtered to `assignedToId = userId`.

---

## 4. UI Layout

### ADMIN / MANAGER view

```
[ Completion Rate ] [ Avg Resolution Time ] [ Active Schedules ] [ Overdue Schedules ]

Work Orders
  Status breakdown: OPEN | IN_PROGRESS | COMPLETED | CANCELLED  (counts)
  Type breakdown:   PREVENTIVE | CORRECTIVE                      (counts)

── Your Stats ──────────────────────────────────────────────────

[ Assigned WOs ] [ Your Completion Rate ] [ Your Avg Resolution Time ]

  Status breakdown: OPEN | IN_PROGRESS | COMPLETED | CANCELLED  (counts)
```

### TECHNICIAN view

```
[ Assigned WOs ] [ Your Completion Rate ] [ Your Avg Resolution Time ]

  Status breakdown: OPEN | IN_PROGRESS | COMPLETED | CANCELLED  (counts)
```

### StatCard

Props: `title`, `value`, `subtitle` (optional).  
`value` is a pre-formatted string passed from the parent (e.g. `"73.4%"`, `"12.5 hrs"`, `"—"`).  
`subtitle` shows supporting context (e.g. `"of 42 total"`).

Avg resolution time displays as `"—"` when `null`. Completion rate displays as `"0%"` when total is 0.

---

## 5. Error Handling

- Service function errors propagate to the Next.js error boundary (standard App Router behavior — no special handling needed in the page).
- `avgResolutionTimeHours` returns `null` on empty array; UI renders `"—"`.
- `completionRate` returns `0` (not `NaN`) when `totalWorkOrders` is 0.

---

## 6. Testing

**`tests/services/reports.test.ts`**

Mock `@/lib/prisma` (same pattern as existing service tests).

`getTenantDashboardStats`:
- Returns correct completion rate for a mix of statuses
- Returns `0` completion rate when no WOs exist
- Returns correct `byStatus` and `byType` counts
- Returns correct `avgResolutionTimeHours` for completed WOs
- Returns `null` for `avgResolutionTimeHours` when no completed WOs
- Returns correct `activeSchedules` and `overdueSchedules` counts

`getTechnicianDashboardStats`:
- Returns counts scoped to the given `userId` only
- Returns `0` completion rate when technician has no WOs
- Returns `null` avg resolution time when technician has no completed WOs
