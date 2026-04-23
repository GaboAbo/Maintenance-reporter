import { AssetForm } from '@/components/assets/AssetForm'
import { getTenantId } from '@/lib/tenant'
import { listCategories } from '@/lib/services/categories'
import { listClients } from '@/lib/services/clients'

export default async function NewAssetPage() {
  const tenantId = await getTenantId()
  const [categories, clients] = await Promise.all([
    listCategories(tenantId),
    listClients(tenantId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New asset</h1>
        <p className="text-sm text-zinc-500">Add a piece of equipment to your asset registry.</p>
      </div>
      <AssetForm categories={categories} clients={clients} />
    </div>
  )
}
