import { getSessionUser } from '@/lib/tenant'
import { getTenantDashboardStats, getTechnicianDashboardStats } from '@/lib/services/reports'
import { TenantStats } from '@/components/dashboard/TenantStats'
import { TechnicianStats } from '@/components/dashboard/TechnicianStats'

export default async function DashboardPage() {
  const user = await getSessionUser()
  const isManager = (['ADMIN', 'MANAGER'] as const).includes(user.role)

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
