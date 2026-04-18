import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    inviteToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { createInvite, acceptInvite, listUsers } from '@/lib/services/users'

beforeEach(() => vi.clearAllMocks())

describe('createInvite', () => {
  it('creates an invite token in db', async () => {
    vi.mocked(db.inviteToken.create).mockResolvedValue({ id: 'inv1', token: 'tok123' } as any)

    const result = await createInvite({
      tenantId: 't1',
      email: 'tech@example.com',
      role: 'TECHNICIAN',
    })

    expect(db.inviteToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't1', email: 'tech@example.com', role: 'TECHNICIAN' }),
      })
    )
    expect(result.token).toBe('tok123')
  })
})

describe('acceptInvite', () => {
  it('throws for expired token', async () => {
    vi.mocked(db.inviteToken.findUnique).mockResolvedValue({
      id: 'inv1',
      tenantId: 't1',
      email: 'tech@example.com',
      role: 'TECHNICIAN',
      token: 'tok123',
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    } as any)

    await expect(
      acceptInvite({ token: 'tok123', name: 'Alice', password: 'pass1234' })
    ).rejects.toThrow('Invite expired or already used')
  })

  it('throws for already-used token', async () => {
    vi.mocked(db.inviteToken.findUnique).mockResolvedValue({
      id: 'inv1',
      tenantId: 't1',
      email: 'tech@example.com',
      role: 'TECHNICIAN',
      token: 'tok123',
      expiresAt: new Date(Date.now() + 10000),
      usedAt: new Date(),
    } as any)

    await expect(
      acceptInvite({ token: 'tok123', name: 'Alice', password: 'pass1234' })
    ).rejects.toThrow('Invite expired or already used')
  })
})

describe('listUsers', () => {
  it('returns users for tenant', async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      { id: 'u1', name: 'Alice', email: 'alice@example.com', role: 'TECHNICIAN', active: true } as any,
    ])

    const users = await listUsers('t1')
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } })
    )
    expect(users).toHaveLength(1)
  })
})
