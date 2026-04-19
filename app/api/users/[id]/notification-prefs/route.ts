import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/tenant'

const PrefsSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser()
    const { id } = await params

    const canEdit =
      sessionUser.id === id ||
      ['ADMIN', 'MANAGER'].includes(sessionUser.role)

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Confirm target user belongs to same tenant
    const targetUser = await db.user.findFirst({
      where: { id, tenantId: sessionUser.tenantId },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PrefsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const prefs = await db.notificationPreference.upsert({
      where: { userId: id },
      update: parsed.data,
      create: { userId: id, email: true, sms: false, ...parsed.data },
    })

    return NextResponse.json(prefs)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
