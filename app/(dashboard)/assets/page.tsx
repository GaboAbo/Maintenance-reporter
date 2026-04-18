import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetTable } from '@/components/assets/AssetTable'
import { getTenantId } from '@/lib/tenant'
import { listAssets } from '@/lib/services/assets'

export default async function AssetsPage() {
  const tenantId = await getTenantId()
  const assets = await listAssets(tenantId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assets</h1>
          <p className="text-sm text-zinc-500">{assets.length} total</p>
        </div>
        <Button asChild>
          <Link href="/assets/new">Add asset</Link>
        </Button>
      </div>
      <AssetTable assets={assets} />
    </div>
  )
}
