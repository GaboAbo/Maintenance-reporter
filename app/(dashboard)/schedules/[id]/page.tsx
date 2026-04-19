import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getTenantId } from '@/lib/tenant'
import { getSchedule } from '@/lib/services/schedules'

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenantId = await getTenantId()
  const schedule = await getSchedule(tenantId, id)

  if (!schedule) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{schedule.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={schedule.status === 'active' ? 'default' : 'secondary'}>
              {schedule.status}
            </Badge>
            <span className="text-sm text-zinc-500">
              Every {schedule.intervalValue} {schedule.intervalUnit ?? 'days'}
            </span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/schedules/${id}/edit`}>Edit</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
        {[
          ['Trigger type', schedule.triggerType.replaceAll('_', ' ')],
          [
            'Next due',
            new Date(schedule.nextDueDate).toLocaleDateString(),
          ],
          ['Assets', schedule.assets.length],
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="font-medium text-zinc-500">{label}</div>
            <div>{value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Linked assets</h2>
        {schedule.assets.length === 0 ? (
          <p className="text-sm text-zinc-500">No assets linked.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {schedule.assets.map(({ asset }) => (
              <li key={asset.id}>
                <Link
                  href={`/assets/${asset.id}`}
                  className="text-sm hover:underline"
                >
                  {asset.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Generated work orders</h2>
        {schedule.workOrders.length === 0 ? (
          <p className="text-sm text-zinc-500">No work orders generated yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {schedule.workOrders.map((wo) => (
              <li
                key={wo.id}
                className="flex items-center justify-between rounded-md border bg-white px-4 py-2 text-sm"
              >
                <Link href={`/work-orders/${wo.id}`} className="hover:underline">
                  {wo.type} — {wo.status}
                </Link>
                <span className="text-zinc-400">
                  {new Date(wo.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
