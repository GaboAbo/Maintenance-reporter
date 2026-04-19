import { WorkOrderForm } from '@/components/work-orders/WorkOrderForm'

export default function NewWorkOrderPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New work order</h1>
        <p className="text-sm text-zinc-500">
          Create a corrective or preventive maintenance work order
        </p>
      </div>
      <WorkOrderForm />
    </div>
  )
}
