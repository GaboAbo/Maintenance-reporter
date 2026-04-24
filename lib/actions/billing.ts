'use server'

import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { getSubscription, SubscriptionEntry } from '@/lib/services/billing'
import { stripe } from '@/lib/stripe'

export async function createPortalSession(
  _prev: { error: string } | null,
  _formData: FormData
): Promise<{ error: string } | null> {
  let user
  try {
    user = await getSessionUser()
  } catch {
    return { error: 'Unauthorized' }
  }

  if (user.role !== 'ADMIN') return { error: 'Unauthorized' }

  let subscription: SubscriptionEntry | null
  try {
    subscription = await getSubscription(user.tenantId)
  } catch {
    return { error: 'Failed to load subscription' }
  }
  if (!subscription) return { error: 'No subscription found' }

  let sessionUrl: string
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    })
    sessionUrl = session.url
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create billing session'
    return { error: message }
  }

  redirect(sessionUrl)
  return null
}
