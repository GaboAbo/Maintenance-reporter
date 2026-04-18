import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const RegisterSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = RegisterSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { orgName, name, email, password } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  }

  const hashed = await hashPassword(password)

  const tenant = await db.tenant.create({
    data: {
      name: orgName,
      users: {
        create: {
          name,
          email,
          password: hashed,
          role: 'ADMIN',
          notificationPrefs: { create: { email: true, sms: false } },
        },
      },
      subscription: {
        create: {
          stripeCustomerId: `pending_${Date.now()}`,
          plan: 'starter',
          status: 'trialing',
        },
      },
    },
  })

  return NextResponse.json({ tenantId: tenant.id }, { status: 201 })
}
