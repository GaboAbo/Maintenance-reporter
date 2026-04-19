import Link from 'next/link'
import type { WorkOrder, User } from '@prisma/client'
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type WorkOrderRow = WorkOrder & {
  assignedTo: Pick<User, 'id' | 'name'> | null
  _count: { items: number }
}

export function WorkOrderTable({ workOrders }: { workOrders: WorkOrderRow[] }) {
  if (workOrders.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No work orders yet. Create one to track maintenance work.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Assigned to</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Assets</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workOrders.map((wo) => (
          <TableRow key={wo.id}>
            <TableCell>
              <Link href={`/work-orders/${wo.id}`} className="font-medium hover:underline capitalize">
                {wo.type.toLowerCase().replace('_', ' ')}
              </Link>
              {wo.description && (
                <div className="text-xs text-zinc-400 max-w-48 truncate">{wo.description}</div>
              )}
            </TableCell>
            <TableCell>
              <WorkOrderStatusBadge status={wo.status} />
            </TableCell>
            <TableCell>
              <PriorityBadge priority={wo.priority} />
            </TableCell>
            <TableCell>{wo.assignedTo?.name ?? '—'}</TableCell>
            <TableCell>
              {wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '—'}
            </TableCell>
            <TableCell>{wo._count.items}</TableCell>
            <TableCell>{new Date(wo.createdAt).toLocaleDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
