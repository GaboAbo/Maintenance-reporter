import { db } from '@/lib/db'
import { sendNotification } from '@/lib/services/notifications'

function advanceDueDate(
  current: Date,
  intervalValue: number,
  intervalUnit: string | null
): Date {
  const next = new Date(current)
  switch (intervalUnit) {
    case 'weeks':
      next.setDate(next.getDate() + intervalValue * 7)
      break
    case 'months': {
      const day = next.getDate()
      next.setMonth(next.getMonth() + intervalValue)
      // Clamp to last day of target month if overflow occurred (e.g. Jan 31 + 1 month)
      if (next.getDate() !== day) {
        next.setDate(0) // day 0 = last day of previous month
      }
      break
    }
    default: // 'days' or null
      next.setDate(next.getDate() + intervalValue)
      break
  }
  return next
}

export async function runPmCheck(): Promise<{ generated: number }> {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // ── WO generation pass ────────────────────────────────────────────────────
  const dueSchedules = await db.maintenanceSchedule.findMany({
    where: { status: 'active', triggerType: 'time_based', nextDueDate: { lte: now } },
    include: { assets: { select: { assetId: true } } },
  })

  let generated = 0

  for (const schedule of dueSchedules) {
    if (schedule.assets.length === 0) continue

    const nextDue = advanceDueDate(
      schedule.nextDueDate,
      schedule.intervalValue,
      schedule.intervalUnit
    )

    try {
      await db.$transaction(async (tx) => {
        await tx.workOrder.create({
          data: {
            tenantId: schedule.tenantId,
            type: 'PREVENTIVE',
            status: 'OPEN',
            priority: 'MEDIUM',
            linkedScheduleId: schedule.id,
            items: {
              create: schedule.assets.map(({ assetId }) => ({ assetId })),
            },
          },
        })

        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { nextDueDate: nextDue },
        })
      })
      generated++
    } catch (err) {
      console.error(`[pm-check] Failed to process schedule ${schedule.id}:`, err)
    }
  }

  // ── WO due_soon notifications ─────────────────────────────────────────────
  const dueSoonWOs = await db.workOrder.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueDate: { gt: now, lte: tomorrow },
      assignedToId: { not: null },
    },
    select: { id: true, assignedToId: true, dueDate: true },
  })
  for (const wo of dueSoonWOs) {
    await sendNotification(wo.assignedToId!, 'wo.due_soon', {
      workOrderId: wo.id,
      dueDate: wo.dueDate!.toISOString(),
    })
  }

  // ── WO overdue notifications ──────────────────────────────────────────────
  const overdueWOs = await db.workOrder.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueDate: { lt: now },
      assignedToId: { not: null },
    },
    select: { id: true, tenantId: true, assignedToId: true, dueDate: true },
  })

  if (overdueWOs.length > 0) {
    const tenantIds = [...new Set(overdueWOs.map((wo) => wo.tenantId))]
    const adminsByTenant = new Map<string, string[]>()
    for (const tenantId of tenantIds) {
      const admins = await db.user.findMany({
        where: { tenantId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
        select: { id: true },
      })
      adminsByTenant.set(tenantId, admins.map((a) => a.id))
    }

    for (const wo of overdueWOs) {
      await sendNotification(wo.assignedToId!, 'wo.overdue', {
        workOrderId: wo.id,
        dueDate: wo.dueDate!.toISOString(),
      })
      const adminIds = adminsByTenant.get(wo.tenantId) ?? []
      for (const adminId of adminIds) {
        if (adminId !== wo.assignedToId) {
          await sendNotification(adminId, 'wo.overdue', {
            workOrderId: wo.id,
            dueDate: wo.dueDate!.toISOString(),
          })
        }
      }
    }
  }

  // ── Schedule due_soon notifications ───────────────────────────────────────
  const dueSoonSchedules = await db.maintenanceSchedule.findMany({
    where: {
      status: 'active',
      triggerType: 'time_based',
      nextDueDate: { gt: now, lte: tomorrow },
    },
    select: { id: true, tenantId: true, name: true, nextDueDate: true },
  })
  for (const schedule of dueSoonSchedules) {
    const admins = await db.user.findMany({
      where: { tenantId: schedule.tenantId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
      select: { id: true },
    })
    for (const admin of admins) {
      await sendNotification(admin.id, 'schedule.due_soon', {
        scheduleName: schedule.name,
        dueDate: schedule.nextDueDate.toISOString(),
      })
    }
  }

  // ── Schedule overdue notifications ────────────────────────────────────────
  const overdueSchedules = await db.maintenanceSchedule.findMany({
    where: {
      status: 'active',
      triggerType: 'time_based',
      nextDueDate: { lt: now },
    },
    select: { id: true, tenantId: true, name: true, nextDueDate: true },
  })
  for (const schedule of overdueSchedules) {
    const admins = await db.user.findMany({
      where: { tenantId: schedule.tenantId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
      select: { id: true },
    })
    for (const admin of admins) {
      await sendNotification(admin.id, 'schedule.overdue', {
        scheduleName: schedule.name,
        dueDate: schedule.nextDueDate.toISOString(),
      })
    }
  }

  return { generated }
}
