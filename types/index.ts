import type { Asset, AssetStatus, User, UserRole, WorkOrder, WorkOrderStatus, Priority, WorkOrderType } from '@prisma/client'

export type { Asset, AssetStatus, User, UserRole, WorkOrder, WorkOrderStatus, Priority, WorkOrderType }

export type SessionUser = {
  id: string
  tenantId: string
  name: string
  email: string
  role: UserRole
}

export type AssetWithCounts = Asset & {
  _count: {
    workOrderItems: number
  }
}

export type ApiError = {
  error: string
  details?: Record<string, string[]>
}
