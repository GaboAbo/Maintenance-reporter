import Link from 'next/link'
import { AssetStatusBadge } from './AssetStatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Asset } from '@prisma/client'

type AssetWithCountAndCategory = Omit<Asset, 'category'> & {
  _count: { workOrderItems: number }
  category: { id: string; name: string } | null
}

export function AssetTable({ assets }: { assets: AssetWithCountAndCategory[] }) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-500">No assets yet. Add your first asset to get started.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Work orders</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell>
              <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                {asset.name}
              </Link>
              {asset.serialNumber && (
                <div className="text-xs text-zinc-400">S/N: {asset.serialNumber}</div>
              )}
            </TableCell>
            <TableCell>{asset.category?.name ?? '—'}</TableCell>
            <TableCell>{asset.location ?? '—'}</TableCell>
            <TableCell>
              <AssetStatusBadge status={asset.status} />
            </TableCell>
            <TableCell>{asset._count.workOrderItems}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
