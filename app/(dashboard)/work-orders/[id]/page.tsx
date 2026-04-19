import { notFound } from 'next/navigation'
import Link from 'next/link'
import { WorkOrderStatusBadge } from '@/components/work-orders/WorkOrderStatusBadge'
import { PriorityBadge } from '@/components/work-orders/PriorityBadge'
import { WorkOrderItemList } from '@/components/work-orders/WorkOrderItemList'
import { getTenantId } from '@/lib/tenant'
import { getWorkOrder } from '@/lib/services/workOrders'

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenantId = await getTenantId()
  const wo = await getWorkOrder(tenantId, id)

  if (!wo) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold capitalize">
            {wo.type.toLowerCase().replaceAll('_', ' ')} work order
          </h1>
          <div className="flex items-center gap-2">
            <WorkOrderStatusBadge status={wo.status} />
            <PriorityBadge priority={wo.priority} />
            {wo.linkedSchedule && (
              <Link
                href={`/schedules/${wo.linkedSchedule.id}`}
                className="text-sm text-zinc-500 hover:underline"
              >
                Schedule: {wo.linkedSchedule.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
        {[
          ['Assigned to', wo.assignedTo?.name ?? 'Unassigned'],
          ['Due date', wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '—'],
          ['Created', new Date(wo.createdAt).toLocaleDateString()],
          ...(wo.completedAt
            ? [['Completed', new Date(wo.completedAt).toLocaleDateString()]]
            : []),
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="font-medium text-zinc-500">{label}</div>
            <div>{value}</div>
          </div>
        ))}
      </div>

      {wo.description && (
        <div className="rounded-lg border bg-white p-4 text-sm">
          <p className="font-medium text-zinc-500 mb-1">Description</p>
          <p>{wo.description}</p>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Assets ({wo.items.length})</h2>
        <WorkOrderItemList workOrderId={wo.id} items={wo.items} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Activity</h2>
        {wo.activities.length === 0 ? (
          <p className="text-sm text-zinc-500">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {wo.activities.map((activity) => (
              <li
                key={activity.id}
                className="flex items-start gap-3 rounded-md border bg-white px-4 py-3 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{activity.user.name}</span>
                  <span className="text-zinc-500">
                    {' '}
                    {activity.eventType === 'STATUS_CHANGED'
                      ? `changed status from ${(activity.payload as { from: string; to: string }).from} to ${(activity.payload as { from: string; to: string }).to}`
                      : activity.eventType === 'CREATED'
                      ? 'created this work order'
                      : activity.eventType === 'ITEM_UPDATED'
                      ? 'updated an item'
                      : activity.eventType.toLowerCase().replaceAll('_', ' ')}
                  </span>
                </div>
                <span className="text-zinc-400 shrink-0">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
