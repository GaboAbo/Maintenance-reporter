import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WorkOrderTable } from '@/components/work-orders/WorkOrderTable'
import { getTenantId } from '@/lib/tenant'
import { listWorkOrders } from '@/lib/services/workOrders'
import type { WorkOrderStatus, WorkOrderType } from '@prisma/client'

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const { status, type } = await searchParams
  const tenantId = await getTenantId()
  const workOrders = await listWorkOrders(tenantId, {
    status: status as WorkOrderStatus | undefined,
    type: type as WorkOrderType | undefined,
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
