'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClientEntry } from '@/lib/services/clients'

type Props = {
  clients: ClientEntry[]
}

export function ClientManager({ clients: initialClients }: Props) {
  const [clients, setClients] = useState(initialClients)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleErrors, setToggleErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')

  async function handleAdd() {
    if (!newName.trim() || !newEmail.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setClients((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
        setNewEmail('')
      } else {
        const data = await res.json().catch(() => ({}))
        setAddError(data.error ?? 'Failed to add client')
      }
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggle(id: string, receives: boolean) {
    setTogglingId(id)
    setToggleErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivesReport: receives }),
      })
      if (res.ok) {
        const updated = await res.json()
        setClients((prev) => prev.map((c) => (c.id === id ? updated : c)))
        setToggleErrors((prev) => { const next = { ...prev }; delete next[id]; return next })
      } else {
        const data = await res.json().catch(() => ({}))
        setToggleErrors((prev) => ({ ...prev, [id]: data.error ?? 'Failed to update' }))
      }
    } catch {
      setToggleErrors((prev) => ({ ...prev, [id]: 'Network error' }))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (res.status === 204) {
        setClients((prev) => prev.filter((c) => c.id !== id))
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

  async function handleSendNow() {
    setSending(true)
    setSendResult('')
    try {
      const res = await fetch('/api/reports/send', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSendResult(`Sent ${data.sent} report(s), skipped ${data.skipped}.`)
      } else {
        const data = await res.json().catch(() => ({}))
        setSendResult(data.error ?? 'Failed to send reports')
      }
    } catch {
      setSendResult('Network error — please try again')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage clients and their weekly maintenance report delivery.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleSendNow} disabled={sending} variant="outline">
            {sending ? 'Sending…' : 'Send reports now'}
          </Button>
          {sendResult && <p className="text-xs text-zinc-500">{sendResult}</p>}
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Email</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-700">Receives report</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-3 text-zinc-400 text-center">
                  No clients yet.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">{client.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{client.email}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={client.receivesReport}
                      onChange={(e) => handleToggle(client.id, e.target.checked)}
                      disabled={togglingId === client.id}
                      aria-label={`Toggle report delivery for ${client.name}`}
                      className="h-4 w-4 cursor-pointer"
                    />
                    {toggleErrors[client.id] && (
                      <p className="mt-1 text-xs text-red-600">{toggleErrors[client.id]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteErrors[client.id] && (
                      <span className="mr-3 text-xs text-red-600">{deleteErrors[client.id]}</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingId === client.id}
                      onClick={() => handleDelete(client.id)}
                    >
                      {deletingId === client.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          disabled={adding}
        />
        <Input
          placeholder="Email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          disabled={adding}
        />
        <Button onClick={handleAdd} disabled={adding || !newName.trim() || !newEmail.trim()}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {addError && <p className="text-sm text-red-600">{addError}</p>}
    </div>
  )
}
