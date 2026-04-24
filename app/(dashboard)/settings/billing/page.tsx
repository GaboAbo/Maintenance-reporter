import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { getSubscription } from '@/lib/services/billing'
import { BillingManager } from '@/components/settings/BillingManager'

export default async function BillingSettingsPage() {
  const user = await getSessionUser()
  if (user.role !== 'ADMIN') redirect('/settings')

  const subscription = await getSubscription(user.tenantId)

  return <BillingManager subscription={subscription} />
}
