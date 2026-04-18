import { NextResponse } from 'next/server'
import { getTenantId } from '@/lib/tenant'
import { listUsers } from '@/lib/services/users'

export async function GET() {
  try {
    const tenantId = await getTenantId()
    const users = await listUsers(tenantId)
    return NextResponse.json(users)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
