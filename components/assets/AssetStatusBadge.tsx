import { Badge } from '@/components/ui/badge'
import type { AssetStatus } from '@prisma/client'

const STATUS_MAP: Record<AssetStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  INACTIVE: { label: 'Inactive', variant: 'secondary' },
  DECOMMISSIONED: { label: 'Decommissioned', variant: 'destructive' },
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const { label, variant } = STATUS_MAP[status]
  return <Badge variant={variant}>{label}</Badge>
}
