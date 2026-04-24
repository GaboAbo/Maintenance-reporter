import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge'
import { getTenantId } from '@/lib/tenant'
import { getAsset } from '@/lib/services/assets'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = await getTenantId()
  const asset = await getAsset(tenantId, id)

  if (!asset) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{asset.name}</h1>
          <div className="flex items-center gap-2">
            <AssetStatusBadge status={asset.status} />
            {asset.category?.name && (
              <span className="text-sm text-zinc-500">{asset.category.name}</span>
            )}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/assets/${id}/edit`}>Edit</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
        {[
          ['Serial number', asset.serialNumber],
          ['Model', asset.model],
          ['Manufacturer', asset.manufacturer],
          ['Location', asset.location],
          ['Client', asset.client?.name],
          ['Installed', asset.installationDate ? new Date(asset.installationDate).toLocaleDateString() : null],
          ['Warranty expires', asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : null],
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="font-medium text-zinc-500">{label}</div>
            <div>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Maintenance history</h2>
        {asset.workOrderItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No work orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asset.workOrderItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border bg-white px-4 py-2 text-sm">
                <Link href={`/work-orders/${item.workOrderId}`} className="hover:underline">
                  {item.workOrder.type} — {item.workOrder.status}
                </Link>
                <span className="text-zinc-400">
                  {new Date(item.workOrder.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
