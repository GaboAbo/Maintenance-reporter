import { auth } from '@/lib/auth'
import type { SessionUser } from '@/types'

export async function getTenantId(): Promise<string> {
  const session = await auth()
  const tenantId = (session?.user as SessionUser | undefined)?.tenantId
  if (!tenantId) throw new Error('Unauthorized')
  return tenantId
}

export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth()
  const user = session?.user as SessionUser | undefined
  if (!user?.tenantId) throw new Error('Unauthorized')
  return user
}
