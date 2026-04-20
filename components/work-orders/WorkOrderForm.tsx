'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Asset, User, WorkOrderType, Priority } from '@prisma/client'

export function WorkOrderForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [assetsError, setAssetsError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [type, setType] = useState<WorkOrderType>('CORRECTIVE')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [assignedToId, setAssignedToId] = useState<string>('__none__')
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/assets')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load assets')
        return r.json()
      })
      .then((data) => {
        setAssets(data)
        setAssetsLoaded(true)
      })
      .catch(() => {
        setAssetsError('Failed to load assets. Please refresh and try again.')
        setAssetsLoaded(true)
      })

    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => {})
  }, [])

  function toggleAsset(id: string) {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const rawDueDate = form.get('dueDate') as string
    const body = {
      type,
      priority,
      description: (form.get('description') as string) || null,
      assignedToId: assignedToId === '__none__' ? null : assignedToId || null,
      dueDate: rawDueDate ? new Date(rawDueDate).toISOString() : null,
      assetIds: Array.from(selectedAssetIds),
    }

    try {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let msg = 'Failed to create work order'
        try {
          const d = await res.json()
          msg = d.error ?? msg
        } catch {}
        setError(msg)
        return
      }
      router.push('/work-orders')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as WorkOrderType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CORRECTIVE">Corrective</SelectItem>
              <SelectItem value="PREVENTIVE">Preventive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Assign to</Label>
          <Select value={assignedToId} onValueChange={setAssignedToId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Assets *</Label>
        {!assetsLoaded ? (
          <p className="text-sm text-zinc-400">Loading assets…</p>
        ) : assetsError ? (
          <p className="text-sm text-red-600">{assetsError}</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-zinc-400">No assets found. Create an asset first.</p>
        ) : (
          <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border p-3">
            {assets.map((asset) => (
              <label
                key={asset.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedAssetIds.has(asset.id)}
                  onChange={() => toggleAsset(asset.id)}
                />
                {asset.name}
                {asset.category?.name && (
                  <span className="text-zinc-400">({asset.category.name})</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !assetsLoaded || selectedAssetIds.size === 0 || !!assetsError}>
          {loading ? 'Creating…' : 'Create work order'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/work-orders')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
