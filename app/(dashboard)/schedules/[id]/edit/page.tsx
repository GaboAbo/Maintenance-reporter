import { notFound } from 'next/navigation'
import { ScheduleForm } from '@/components/schedules/ScheduleForm'
import { getTenantId } from '@/lib/tenant'
import { getSchedule } from '@/lib/services/schedules'

export default async function EditSchedulePage({
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
      <div>
        <h1 className="text-2xl font-semibold">Edit schedule</h1>
        <p className="text-sm text-zinc-500">{schedule.name}</p>
      </div>
      <ScheduleForm schedule={schedule} />
    </div>
  )
}
