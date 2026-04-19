'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  user: {
    id: string
    name: string
    email: string
    phone: string | null
    notificationPrefs: { email: boolean; sms: boolean } | null
  }
}

export function ProfileForm({ user }: Props) {
  const router = useRouter()
  const prefs = user.notificationPrefs ?? { email: true, sms: false }
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [emailPref, setEmailPref] = useState(prefs.email)
  const [smsPref, setSmsPref] = useState(prefs.sms)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      const [profileRes, prefsRes] = await Promise.all([
        fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone: phone || null }),
        }),
        fetch(`/api/users/${user.id}/notification-prefs`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailPref, sms: smsPref }),
        }),
      ])
      if (profileRes.ok && prefsRes.ok) {
        setMessage('Saved.')
        router.refresh()
      } else {
        setMessage('Failed to save. Please try again.')
      }
    } catch {
      setMessage('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Profile settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your personal details and notification preferences.</p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-zinc-700">Personal details</h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled className="bg-zinc-50 text-zinc-500" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone (for SMS notifications)</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15550001234"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-zinc-700">Notification preferences</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={emailPref}
            onChange={(e) => setEmailPref(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Email notifications</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={smsPref}
            onChange={(e) => setSmsPref(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">SMS notifications</span>
        </label>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {message && (
          <p className={`text-sm ${message === 'Saved.' ? 'text-zinc-500' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
