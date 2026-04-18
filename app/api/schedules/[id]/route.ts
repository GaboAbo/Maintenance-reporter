import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import {
  getSchedule,
  updateSchedule,
  toggleScheduleStatus,
  deleteSchedule,
} from '@/lib/services/schedules'

const UpdateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  triggerType: z.enum(['time_based', 'usage_based']).optional(),
  intervalValue: z.number().int().positive().optional(),
  intervalUnit: z.enum(['days', 'weeks', 'months']).optional().nullable(),
  nextDueDate: z.string().datetime().optional(),
  assetIds: z.array(z.string()).min(1).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    const schedule = await getSchedule(tenantId, id)
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(schedule)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = UpdateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { nextDueDate, ...rest } = parsed.data
    const schedule = await updateSchedule(tenantId, id, {
      ...rest,
      ...(nextDueDate !== undefined && { nextDueDate: new Date(nextDueDate) }),
    })
    return NextResponse.json(schedule)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    const schedule = await toggleScheduleStatus(tenantId, id)
    return NextResponse.json(schedule)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    await deleteSchedule(tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
