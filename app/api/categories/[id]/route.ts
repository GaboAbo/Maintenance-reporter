import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/tenant'
import { deleteCategory } from '@/lib/services/categories'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await deleteCategory(user.tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'FORBIDDEN') return NextResponse.json({ error: 'System categories cannot be deleted' }, { status: 403 })
    if (err.code === 'NOT_FOUND') return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    if (err.code === 'IN_USE') return NextResponse.json({ error: err.message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
