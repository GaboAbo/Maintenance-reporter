import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subscription: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { getSubscription } from '@/lib/services/billing'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('getSubscription', () => {
  it('returns subscription when found', async () => {
    const sub = {
      id: 's1',
      tenantId: TENANT,
      stripeCustomerId: 'cus_123',
      plan: 'starter',
      status: 'active',
      currentPeriodEnd: null,
    }
    vi.mocked(db.subscription.findUnique).mockResolvedValue(sub as any)
    const result = await getSubscription(TENANT)
    expect(result).toEqual(sub)
    expect(db.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } })
    )
  })

  it('returns null when no subscription exists', async () => {
    vi.mocked(db.subscription.findUnique).mockResolvedValue(null)
    const result = await getSubscription(TENANT)
    expect(result).toBeNull()
  })
})
