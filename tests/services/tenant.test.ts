import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { getTenantId } from '@/lib/tenant'

describe('getTenantId', () => {
  it('returns tenantId from session', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u1', tenantId: 't1', role: 'ADMIN' },
    } as any)
    expect(await getTenantId()).toBe('t1')
  })

  it('throws when session missing', async () => {
    vi.mocked(auth).mockResolvedValue(null)
    await expect(getTenantId()).rejects.toThrow('Unauthorized')
  })
})
