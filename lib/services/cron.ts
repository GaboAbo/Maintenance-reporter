import { db } from '@/lib/db'

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
    case 'months':
      next.setMonth(next.getMonth() + intervalValue)
      break
    default: // 'days' or null
      next.setDate(next.getDate() + intervalValue)
      break
  }
  return next
}

export async function runPmCheck(): Promise<{ generated: number }> {
  const now = new Date()

  const dueSchedules = await db.maintenanceSchedule.findMany({
    where: { status: 'active', nextDueDate: { lte: now } },
    include: { assets: { select: { assetId: true } } },
  })

  let generated = 0

  for (const schedule of dueSchedules) {
    if (schedule.assets.length === 0) continue

    await db.workOrder.create({
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

    const nextDue = advanceDueDate(
      schedule.nextDueDate,
      schedule.intervalValue,
      schedule.intervalUnit
    )
    await db.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: { nextDueDate: nextDue },
    })

    generated++
  }

  return { generated }
}
