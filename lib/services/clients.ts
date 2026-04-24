import { db } from '@/lib/db'

export type ClientEntry = {
  id: string
  tenantId: string
  name: string
  email: string
  receivesReport: boolean
  createdAt: Date
}

const SELECT = { id: true, tenantId: true, name: true, email: true, receivesReport: true, createdAt: true }

export async function listClients(tenantId: string): Promise<ClientEntry[]> {
  return db.client.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: SELECT,
  })
}

export async function createClient(tenantId: string, name: string, email: string): Promise<ClientEntry> {
  const existing = await db.client.findFirst({ where: { tenantId, email } })
  if (existing) throw Object.assign(new Error('A client with this email already exists'), { code: 'DUPLICATE' })
  return db.client.create({
    data: { tenantId, name, email },
    select: SELECT,
  })
}

export async function deleteClient(tenantId: string, clientId: string): Promise<void> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, tenantId: true },
  })
  if (!client) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })
  if (client.tenantId !== tenantId) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })

  const assetCount = await db.asset.count({ where: { clientId } })
  if (assetCount > 0) {
    throw Object.assign(
      new Error(`Client has ${assetCount} assigned asset(s)`),
      { code: 'IN_USE', count: assetCount }
    )
  }

  await db.client.delete({ where: { id: clientId } })
}

export async function toggleReportRecipient(tenantId: string, clientId: string, receives: boolean): Promise<ClientEntry> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, tenantId: true },
  })
  if (!client) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })
  if (client.tenantId !== tenantId) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })

  return db.client.update({
    where: { id: clientId },
    data: { receivesReport: receives },
    select: SELECT,
  })
}
