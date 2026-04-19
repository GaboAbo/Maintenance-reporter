import type { WorkOrderStatus, WorkOrderType } from '@prisma/client'

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const TYPE_LABELS: Record<WorkOrderType, string> = {
  PREVENTIVE: 'Preventive',
  CORRECTIVE: 'Corrective',
}
