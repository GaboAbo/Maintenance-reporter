import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { listUsersWithPrefs } from '@/lib/services/users'
import { UserPrefsTable } from '@/components/settings/UserPrefsTable'

export default async function SettingsUsersPage() {
  const sessionUser = await getSessionUser()

  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) {
    redirect('/settings')
  }

  const users = await listUsersWithPrefs(sessionUser.tenantId)

  return <UserPrefsTable users={users} sessionUserId={sessionUser.id} />
}
