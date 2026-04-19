import { StatCard } from './StatCard'
import type { TechnicianDashboardStats } from '@/lib/services/reports'
import { STATUS_LABELS } from '@/lib/constants/workOrders'

type Props = {
  stats: TechnicianDashboardStats
  heading?: string
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
