import { NextResponse } from 'next/server'
import { sendAllTenantReports } from '@/lib/services/report-delivery'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendAllTenantReports()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cron/weekly-report] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
