import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import { getAsset, updateAsset, decommissionAsset } from '@/lib/services/assets'

const UpdateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED']).optional(),
  installationDate: z.string().datetime().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    const asset = await getAsset(tenantId, id)
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = UpdateAssetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { installationDate, warrantyExpiry, ...rest } = parsed.data
    const asset = await updateAsset(tenantId, id, {
      ...rest,
      ...(installationDate !== undefined && { installationDate: installationDate ? new Date(installationDate) : null }),
      ...(warrantyExpiry !== undefined && { warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null }),
    })

    return NextResponse.json(asset)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    await decommissionAsset(tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
