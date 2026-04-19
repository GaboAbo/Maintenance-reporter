import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WorkOrderTable } from '@/components/work-orders/WorkOrderTable'
import { getTenantId } from '@/lib/tenant'
import { listWorkOrders } from '@/lib/services/workOrders'
import type { WorkOrderStatus, WorkOrderType } from '@prisma/client'

const VALID_STATUSES = new Set<WorkOrderStatus>(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
const VALID_TYPES = new Set<WorkOrderType>(['PREVENTIVE', 'CORRECTIVE'])

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const { status, type } = await searchParams
  const tenantId = await getTenantId()

  const validStatus = status && VALID_STATUSES.has(status as WorkOrderStatus) ? (status as WorkOrderStatus) : undefined
  const validType = type && VALID_TYPES.has(type as WorkOrderType) ? (type as WorkOrderType) : undefined

  const workOrders = await listWorkOrders(tenantId, {
    status: validStatus,
    type: validType,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Work Orders</h1>
          <p className="text-sm text-zinc-500">{workOrders.length} total</p>
        </div>
        <Button asChild>
          <Link href="/work-orders/new">New work order</Link>
        </Button>
      </div>
      <WorkOrderTable workOrders={workOrders} />
    </div>
  )
}
