'use client'

import { useState } from 'react'

type UserWithPrefs = {
  id: string
  name: string
  email: string
  role: string
  notificationPrefs: { email: boolean; sms: boolean } | null
}

type Props = {
  users: UserWithPrefs[]
  sessionUserId: string
}

export function UserPrefsTable({ users: initialUsers, sessionUserId }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [saving, setSaving] = useState<string | null>(null)

  async function toggle(userId: string, field: 'email' | 'sms', value: boolean) {
    setSaving(`${userId}-${field}`)
    try {
      const res = await fetch(`/api/users/${userId}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  notificationPrefs: {
                    email: u.notificationPrefs?.email ?? true,
                    sms: u.notificationPrefs?.sms ?? false,
                    [field]: value,
                  },
                }
              : u
          )
        )
      }
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage notification preferences for your team.</p>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Email</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Role</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-700">Email notifs</th>
              <th className="px-4 py-3 text-center font-medium text-zinc-700">SMS notifs</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => {
              const prefs = user.notificationPrefs ?? { email: true, sms: false }
              return (
                <tr key={user.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium">
                    {user.name}
                    {user.id === sessionUserId && (
                      <span className="ml-2 text-xs text-zinc-400">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                  <td className="px-4 py-3 text-zinc-500 capitalize">{user.role.toLowerCase()}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={prefs.email}
                      disabled={saving === `${user.id}-email`}
                      onChange={(e) => toggle(user.id, 'email', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={prefs.sms}
                      disabled={saving === `${user.id}-sms`}
                      onChange={(e) => toggle(user.id, 'sms', e.target.checked)}
                      className="h-4 w-4"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
