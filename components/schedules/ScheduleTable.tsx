import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type ScheduleRow = {
  id: string
  name: string
  triggerType: string
  intervalValue: number
  intervalUnit: string | null
  nextDueDate: Date | string
  status: string
  assets: { asset: { id: string; name: string } }[]
  _count: { workOrders: number }
}

export function ScheduleTable({ schedules }: { schedules: ScheduleRow[] }) {
  if (schedules.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No schedules yet. Create one to automate preventive maintenance.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Interval</TableHead>
          <TableHead>Next due</TableHead>
          <TableHead>Assets</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Work orders</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((s) => {
          const isOverdue = s.status === 'active' && new Date(s.nextDueDate) < new Date()
          return (
            <TableRow key={s.id}>
              <TableCell>
                <Link href={`/schedules/${s.id}`} className="font-medium hover:underline">
                  {s.name}
                </Link>
              </TableCell>
              <TableCell>
                Every {s.intervalValue} {s.intervalUnit ?? 'days'}
              </TableCell>
              <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>
                {new Date(s.nextDueDate).toLocaleDateString()}
                {isOverdue && ' (overdue)'}
              </TableCell>
              <TableCell>{s.assets.length}</TableCell>
              <TableCell>
                <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell>{s._count.workOrders}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
