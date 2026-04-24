import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/tenant'
import { sendReportsForTenant } from '@/lib/services/report-delivery'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await sendReportsForTenant(user.tenantId)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
