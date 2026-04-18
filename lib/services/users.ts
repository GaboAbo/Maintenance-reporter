import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import type { UserRole } from '@prisma/client'

export async function createInvite({
  tenantId,
  email,
  role,
}: {
  tenantId: string
  email: string
  role: UserRole
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  return db.inviteToken.create({
    data: { tenantId, email, role, expiresAt },
  })
}

export async function acceptInvite({
  token,
  name,
  password,
}: {
  token: string
  name: string
  password: string
}) {
  const invite = await db.inviteToken.findUnique({ where: { token } })

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    throw new Error('Invite expired or already used')
  }

  const existing = await db.user.findUnique({ where: { email: invite.email } })
  if (existing) throw new Error('Email already registered')

  const hashed = await hashPassword(password)

  const user = await db.user.create({
    data: {
      tenantId: invite.tenantId,
      name,
      email: invite.email,
      password: hashed,
      role: invite.role,
      notificationPrefs: { create: { email: true, sms: false } },
    },
  })

  await db.inviteToken.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  })

  return user
}

export async function listUsers(tenantId: string) {
  return db.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, phone: true, active: true, createdAt: true },
    orderBy: { name: 'asc' },
  })
}
