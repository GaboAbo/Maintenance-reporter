import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { user: { findFirst: vi.fn() } },
}))

import { hashPassword, verifyPassword } from '@/lib/auth'

describe('hashPassword', () => {
  it('returns a hash different from the original', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(hash.length).toBeGreaterThan(20)
  })
})

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
