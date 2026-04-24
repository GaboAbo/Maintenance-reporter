import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { listClients, createClient } from '@/lib/services/clients'

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
})

export async function GET() {
  try {
    const user = await getSessionUser()
    const clients = await listClients(user.tenantId)
    return NextResponse.json(clients)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const client = await createClient(user.tenantId, parsed.data.name, parsed.data.email)
    return NextResponse.json(client, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'DUPLICATE') return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
