import { db } from '@/lib/db'
import { sendEmailWithAttachment } from '@/lib/notifications/resend'
import { generateClientReportPdf } from '@/lib/services/report-generator'

export async function sendReportsForTenant(tenantId: string): Promise<{ sent: number; skipped: number }> {
  let sent = 0
  let skipped = 0

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  if (!tenant) return { sent, skipped }

  const clients = await db.client.findMany({
    where: { tenantId, receivesReport: true },
    select: { id: true, name: true, email: true },
  })

  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  for (const client of clients) {
    const assets = await db.asset.findMany({
      where: { clientId: client.id, tenantId },
      include: { category: { select: { name: true } } },
    })

    if (assets.length === 0) {
      skipped++
      continue
    }

    const assetIds = assets.map((a) => a.id)
    const workOrderItems = await db.workOrderItem.findMany({
      where: {
        assetId: { in: assetIds },
        workOrder: { createdAt: { gte: periodStart, lte: periodEnd } },
      },
      include: {
        workOrder: {
          select: {
            type: true, status: true, description: true, completedAt: true,
            assignedTo: { select: { name: true } },
          },
        },
      },
    })

    const woMap = new Map<string, (typeof workOrderItems)[0]['workOrder']>()
    for (const item of workOrderItems) {
      woMap.set(item.workOrderId, item.workOrder)
    }

    const pdf = await generateClientReportPdf({
      tenantName: tenant.name,
      client: { name: client.name, email: client.email },
      periodStart,
      periodEnd,
      assets: assets.map((a) => ({
        name: a.name,
        category: a.category?.name ?? null,
        location: a.location,
        status: a.status,
      })),
      workOrders: Array.from(woMap.values()).map((wo) => ({
        type: wo.type,
        status: wo.status,
        description: wo.description,
        technicianName: wo.assignedTo?.name ?? null,
        completedAt: wo.completedAt,
      })),
    })

    const dateStr = periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    await sendEmailWithAttachment(
      client.email,
      `Maintenance Report — ${tenant.name} — ${dateStr}`,
      `Dear ${client.name},\n\nPlease find attached your maintenance report for the past 7 days.\n\nRegards,\n${tenant.name}`,
      { filename: `maintenance-report-${dateStr.replace(/[,\s]+/g, '-')}.pdf`, content: pdf }
    )

    sent++
  }

  return { sent, skipped }
}

export async function sendAllTenantReports(): Promise<void> {
  const tenants = await db.tenant.findMany({ select: { id: true } })
  for (const tenant of tenants) {
    await sendReportsForTenant(tenant.id)
  }
}
