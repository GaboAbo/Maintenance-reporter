import { Badge } from '@/components/ui/badge'
import type { Priority } from '@prisma/client'

const PRIORITY_MAP: Record<Priority, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  LOW: { label: 'Low', variant: 'outline' },
  MEDIUM: { label: 'Medium', variant: 'secondary' },
  HIGH: { label: 'High', variant: 'default' },
  CRITICAL: { label: 'Critical', variant: 'destructive' },
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, variant } = PRIORITY_MAP[priority] ?? { label: priority, variant: 'secondary' as const }
  return <Badge variant={variant}>{label}</Badge>
}
