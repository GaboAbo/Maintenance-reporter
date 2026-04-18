import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScheduleTable } from '@/components/schedules/ScheduleTable'
import { getTenantId } from '@/lib/tenant'
import { listSchedules } from '@/lib/services/schedules'

export default async function SchedulesPage() {
  const tenantId = await getTenantId()
  const schedules = await listSchedules(tenantId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Schedules</h1>
          <p className="text-sm text-zinc-500">{schedules.length} total</p>
        </div>
        <Button asChild>
          <Link href="/schedules/new">New schedule</Link>
        </Button>
      </div>
      <ScheduleTable schedules={schedules} />
    </div>
  )
}
