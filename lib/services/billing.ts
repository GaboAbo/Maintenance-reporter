import { db } from '@/lib/db'

export type SubscriptionEntry = {
  id: string
  tenantId: string
  stripeCustomerId: string
  plan: string
  status: string
  currentPeriodEnd: Date | null
}

const SELECT = {
  id: true,
  tenantId: true,
  stripeCustomerId: true,
  plan: true,
  status: true,
  currentPeriodEnd: true,
}

export async function getSubscription(tenantId: string): Promise<SubscriptionEntry | null> {
  return db.subscription.findUnique({
    where: { tenantId },
    select: SELECT,
  })
}
