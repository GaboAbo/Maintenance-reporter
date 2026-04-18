import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/tenant'
import { listUsers } from '@/lib/services/users'

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const users = await listUsers(sessionUser.tenantId)
    return NextResponse.json(users)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
