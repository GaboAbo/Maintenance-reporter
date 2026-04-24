import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/tenant', () => ({
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/services/billing', () => ({
  getSubscription: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { getSessionUser } from '@/lib/tenant'
import { getSubscription } from '@/lib/services/billing'
import { stripe } from '@/lib/stripe'
import { redirect } from 'next/navigation'
import { createPortalSession } from '@/lib/actions/billing'

beforeEach(() => vi.clearAllMocks())

describe('createPortalSession', () => {
  it('returns error when caller is not ADMIN', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'MANAGER', tenantId: 't1' } as any)
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('returns error when no subscription exists', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'ADMIN', tenantId: 't1' } as any)
    vi.mocked(getSubscription).mockResolvedValue(null)
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'No subscription found' })
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('creates portal session and redirects on success', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'ADMIN', tenantId: 't1' } as any)
    vi.mocked(getSubscription).mockResolvedValue({ stripeCustomerId: 'cus_123' } as any)
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: 'https://billing.stripe.com/p/session_xxx',
    } as any)

    const result = await createPortalSession(null, new FormData())

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: expect.stringContaining('/settings/billing'),
    })
    expect(redirect).toHaveBeenCalledWith('https://billing.stripe.com/p/session_xxx')
    expect(result).toBeNull()
  })

  it('returns error when getSessionUser throws', async () => {
    vi.mocked(getSessionUser).mockRejectedValue(new Error('Unauthorized'))
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'Unauthorized' })
  })

  it('returns error when getSubscription throws', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'ADMIN', tenantId: 't1' } as any)
    vi.mocked(getSubscription).mockRejectedValue(new Error('DB error'))
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'Failed to load subscription' })
  })
})
