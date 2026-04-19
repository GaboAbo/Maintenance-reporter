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
  let totalMs = 0
  let count = 0
  for (const wo of wos) {
    if (!wo.completedAt) continue
    totalMs += wo.completedAt.getTime() - wo.createdAt.getTime()
    count++
  }
  if (count === 0) return null
  return Math.round((totalMs / count / 3_600_000) * 10) / 10
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
