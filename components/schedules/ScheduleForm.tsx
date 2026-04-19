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
import type { Asset } from '@prisma/client'

type TriggerType = 'time_based' | 'usage_based'
type IntervalUnit = 'days' | 'weeks' | 'months'

type ScheduleFormProps = {
  schedule?: {
    id: string
    name: string
    triggerType: string
    intervalValue: number
    intervalUnit: string | null
    nextDueDate: Date | string
    assets: { asset: { id: string; name: string } }[]
  }
}

export function ScheduleForm({ schedule }: ScheduleFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [assetsError, setAssetsError] = useState('')
  const [triggerType, setTriggerType] = useState<TriggerType>(
    (schedule?.triggerType as TriggerType) ?? 'time_based'
  )
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    (schedule?.intervalUnit as IntervalUnit) ?? 'days'
  )
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set(schedule?.assets.map((a) => a.asset.id) ?? [])
  )

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

    const body = {
      name: form.get('name'),
      triggerType,
      intervalValue: Number(form.get('intervalValue')),
      intervalUnit: triggerType === 'time_based' ? intervalUnit : null,
      nextDueDate: new Date(form.get('nextDueDate') as string).toISOString(),
      assetIds: Array.from(selectedAssetIds),
    }

    const url = schedule ? `/api/schedules/${schedule.id}` : '/api/schedules'
    const method = schedule ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let msg = 'Failed to save schedule'
        try {
          const d = await res.json()
          msg = d.error ?? msg
        } catch {}
        setError(msg)
        return
      }
      router.push('/schedules')
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
        <Input id="name" name="name" defaultValue={schedule?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Trigger type</Label>
          <Select
            value={triggerType}
            onValueChange={(v) => setTriggerType(v as TriggerType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time_based">Time based</SelectItem>
              <SelectItem value="usage_based">Usage based</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intervalValue">Every</Label>
          <div className="flex gap-2">
            <Input
              id="intervalValue"
              name="intervalValue"
              type="number"
              min="1"
              defaultValue={schedule?.intervalValue ?? 30}
              required
              className="w-20"
            />
            {triggerType === 'time_based' && (
              <Select
                value={intervalUnit}
                onValueChange={(v) => setIntervalUnit(v as IntervalUnit)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="weeks">Weeks</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nextDueDate">Next due date *</Label>
        <Input
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          defaultValue={
            schedule?.nextDueDate
              ? new Date(schedule.nextDueDate).toISOString().split('T')[0]
              : ''
          }
          required
        />
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
                {asset.category && (
                  <span className="text-zinc-400">({asset.category})</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading || selectedAssetIds.size === 0 || !!assetsError}>
          {loading ? 'Saving…' : schedule ? 'Update schedule' : 'Create schedule'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/schedules')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
