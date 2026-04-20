import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import { listAssets, createAsset } from '@/lib/services/assets'

const AssetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED']).optional(),
  installationDate: z.string().datetime().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
})

export async function GET() {
  try {
    const tenantId = await getTenantId()
    const assets = await listAssets(tenantId)
    return NextResponse.json(assets)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = AssetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { installationDate, warrantyExpiry, ...rest } = parsed.data
    const asset = await createAsset(tenantId, {
      ...rest,
      installationDate: installationDate ? new Date(installationDate) : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
