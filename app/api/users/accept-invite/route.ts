import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { acceptInvite } from '@/lib/services/users'

const AcceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = AcceptSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  try {
    const user = await acceptInvite(parsed.data)
    return NextResponse.json({ email: user.email }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
