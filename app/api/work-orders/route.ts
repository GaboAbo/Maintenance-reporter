import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { listWorkOrders, createWorkOrder } from '@/lib/services/workOrders'

const CreateWorkOrderSchema = z.object({
  type: z.enum(['PREVENTIVE', 'CORRECTIVE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  linkedScheduleId: z.string().optional().nullable(),
  assetIds: z.array(z.string()).min(1, 'At least one asset is required'),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    const { searchParams } = new URL(req.url)

    const filtersResult = z.object({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      type: z.enum(['PREVENTIVE', 'CORRECTIVE']).optional(),
      assignedToId: z.string().optional(),
    }).safeParse({
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      assignedToId: searchParams.get('assignedToId') ?? undefined,
    })

    if (!filtersResult.success) {
      return NextResponse.json(
        { error: 'Invalid filter value', details: filtersResult.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const workOrders = await listWorkOrders(user.tenantId, filtersResult.data)
    return NextResponse.json(workOrders)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = CreateWorkOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { dueDate, ...rest } = parsed.data
    const workOrder = await createWorkOrder(user.tenantId, user.id, {
      ...rest,
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    })
    return NextResponse.json(workOrder, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (err.code === 'P2003') return NextResponse.json({ error: 'Invalid asset reference' }, { status: 400 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
