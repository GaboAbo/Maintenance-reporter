import { notFound } from 'next/navigation'
import { AssetForm } from '@/components/assets/AssetForm'
import { getTenantId } from '@/lib/tenant'
import { getAsset } from '@/lib/services/assets'
import { listCategories } from '@/lib/services/categories'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = await getTenantId()
  const [asset, categories] = await Promise.all([
    getAsset(tenantId, id),
    listCategories(tenantId),
  ])

  if (!asset) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit asset</h1>
        <p className="text-sm text-zinc-500">{asset.name}</p>
      </div>
      <AssetForm asset={asset} categories={categories} />
    </div>
  )
}
