import { ScheduleForm } from '@/components/schedules/ScheduleForm'

export default function NewSchedulePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New schedule</h1>
        <p className="text-sm text-zinc-500">
          Set up a recurring preventive maintenance schedule
        </p>
      </div>
      <ScheduleForm />
    </div>
  )
}
