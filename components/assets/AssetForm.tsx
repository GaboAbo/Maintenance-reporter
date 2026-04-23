'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AssetStatus } from '@prisma/client'
import type { CategoryEntry } from '@/lib/services/categories'
import type { ClientEntry } from '@/lib/services/clients'

type AssetFormAsset = {
  id: string
  name: string
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  location?: string | null
  categoryId?: string | null
  clientId?: string | null
  status: AssetStatus
}

type AssetFormProps = {
  asset?: AssetFormAsset
  categories: CategoryEntry[]
  clients: ClientEntry[]
}

export function AssetForm({ asset, categories, clients }: AssetFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'ACTIVE')
  const [categoryId, setCategoryId] = useState<string>(asset?.categoryId ?? 'none')
  const [clientId, setClientId] = useState<string>(asset?.clientId ?? 'none')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const body = {
      name: form.get('name'),
      serialNumber: form.get('serialNumber') || null,
      model: form.get('model') || null,
      manufacturer: form.get('manufacturer') || null,
      location: form.get('location') || null,
      categoryId: categoryId === 'none' ? null : categoryId,
      clientId: clientId === 'none' ? null : clientId,
      status,
    }

    const url = asset ? `/api/assets/${asset.id}` : '/api/assets'
    const method = asset ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let msg = 'Failed to save asset'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch {}
        setError(msg)
        return
      }

      router.push('/assets')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" defaultValue={asset?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" name="serialNumber" defaultValue={asset?.serialNumber ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" defaultValue={asset?.model ?? ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" name="manufacturer" defaultValue={asset?.manufacturer ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={asset?.location ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="No client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as AssetStatus)}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : asset ? 'Update asset' : 'Create asset'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/assets')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
