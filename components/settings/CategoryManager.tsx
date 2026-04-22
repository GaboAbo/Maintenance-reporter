'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CategoryEntry } from '@/lib/services/categories'

type Props = {
  categories: CategoryEntry[]
}

export function CategoryManager({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
      } else {
        const data = await res.json().catch(() => ({}))
        setAddError(data.error ?? 'Failed to add category')
      }
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (res.status === 204) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
        setDeleteErrors((prev) => { const next = { ...prev }; delete next[id]; return next })
      } else {
        const data = await res.json().catch(() => ({}))
        setDeleteErrors((prev) => ({ ...prev, [id]: data.error ?? 'Failed to delete' }))
      }
    } catch {
      setDeleteErrors((prev) => ({ ...prev, [id]: 'Network error' }))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Asset categories</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage custom categories for your team's assets.</p>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-zinc-400 text-center">
                  No custom categories yet.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">{cat.name}</td>
                  <td className="px-4 py-3 text-right">
                    {deleteErrors[cat.id] && (
                      <span className="mr-3 text-xs text-red-600">{deleteErrors[cat.id]}</span>
                    )}
                    {!cat.isSystem && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deletingId === cat.id}
                        onClick={() => handleDelete(cat.id)}
                      >
                        {deletingId === cat.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 max-w-sm">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          disabled={adding}
        />
        <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {addError && <p className="text-sm text-red-600">{addError}</p>}
    </div>
  )
}
