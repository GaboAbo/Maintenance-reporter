'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Item = {
  id: string
  status: string
  notes: string | null
  asset: { id: string; name: string }
}

const STATUS_SEQUENCE: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'completed',
}

export function WorkOrderItemList({
  workOrderId,
  items,
}: {
  workOrderId: string
  items: Item[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.notes ?? '']))
  )

  async function updateItem(itemId: string, data: { status?: string; notes?: string }) {
    setSaving(itemId)
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return
      router.refresh()
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-medium">{item.asset.name}</p>
              <span
                className={`text-xs font-medium capitalize ${
                  item.status === 'completed'
                    ? 'text-green-600'
                    : item.status === 'in_progress'
                    ? 'text-blue-600'
                    : 'text-zinc-500'
                }`}
              >
                {item.status.replaceAll('_', ' ')}
              </span>
            </div>
            {STATUS_SEQUENCE[item.status] && (
              <Button
                size="sm"
                variant="outline"
                disabled={saving === item.id}
                onClick={() => updateItem(item.id, { status: STATUS_SEQUENCE[item.status] })}
              >
                {saving === item.id
                  ? 'Saving…'
                  : item.status === 'open'
                  ? 'Start'
                  : 'Complete'}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Textarea
              rows={2}
              placeholder="Notes…"
              value={notes[item.id]}
              onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
              onBlur={() => {
                if (notes[item.id] !== (item.notes ?? '')) {
                  updateItem(item.id, { notes: notes[item.id] })
                }
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
