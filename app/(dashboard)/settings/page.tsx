import { getSessionUser } from '@/lib/tenant'
import { db } from '@/lib/db'
import { ProfileForm } from '@/components/settings/ProfileForm'

export default async function SettingsPage() {
  const sessionUser = await getSessionUser()
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notificationPrefs: { select: { email: true, sms: true } },
    },
  })

  return <ProfileForm user={user!} />
}
