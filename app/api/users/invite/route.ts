import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { createInvite } from '@/lib/services/users'
import type { UserRole } from '@prisma/client'

const InviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(['MANAGER', 'TECHNICIAN']),
})

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = InviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const invite = await createInvite({
      tenantId: sessionUser.tenantId,
      email: parsed.data.email,
      role: parsed.data.role as UserRole,
    })

    return NextResponse.json({
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`,
    }, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
