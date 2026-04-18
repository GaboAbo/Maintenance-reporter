import { NextResponse } from 'next/server'
import { runPmCheck } from '@/lib/services/cron'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runPmCheck()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/pm-check] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
