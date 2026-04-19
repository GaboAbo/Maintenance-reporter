import { Badge } from '@/components/ui/badge'
import type { WorkOrderStatus } from '@prisma/client'

const STATUS_MAP: Record<WorkOrderStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  OPEN: { label: 'Open', variant: 'outline' },
  IN_PROGRESS: { label: 'In progress', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
}

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'secondary' as const }
  return <Badge variant={variant}>{label}</Badge>
}
