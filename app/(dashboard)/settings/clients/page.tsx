import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { listClients } from '@/lib/services/clients'
import { ClientManager } from '@/components/settings/ClientManager'

export default async function ClientsSettingsPage() {
  const user = await getSessionUser()
  if (user.role !== 'ADMIN') redirect('/settings')

  const clients = await listClients(user.tenantId)

  return <ClientManager clients={clients} />
}
