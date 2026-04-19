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
