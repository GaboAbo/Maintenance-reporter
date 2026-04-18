import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import { listSchedules, createSchedule } from '@/lib/services/schedules'

const CreateScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  triggerType: z.enum(['time_based', 'usage_based']),
  intervalValue: z.number().int().positive(),
  intervalUnit: z.enum(['days', 'weeks', 'months']).optional().nullable(),
  nextDueDate: z.string().datetime(),
  assetIds: z.array(z.string()).min(1, 'At least one asset is required'),
})

export async function GET() {
  try {
    const tenantId = await getTenantId()
    const schedules = await listSchedules(tenantId)
    return NextResponse.json(schedules)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = CreateScheduleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { nextDueDate, ...rest } = parsed.data
    const schedule = await createSchedule(tenantId, {
      ...rest,
      nextDueDate: new Date(nextDueDate),
    })
    return NextResponse.json(schedule, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
