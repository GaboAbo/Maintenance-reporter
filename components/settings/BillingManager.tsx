'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { createPortalSession } from '@/lib/actions/billing'
import type { SubscriptionEntry } from '@/lib/services/billing'

type Props = {
  subscription: SubscriptionEntry | null
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-yellow-100 text-yellow-800',
  canceled: 'bg-red-100 text-red-800',
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
}

export function BillingManager({ subscription }: Props) {
  const [state, formAction, isPending] = useActionState(createPortalSession, null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your subscription and billing details.</p>
      </div>

      <div className="rounded-md border bg-white p-6 max-w-md">
        {subscription === null ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-zinc-700">Plan: No plan</p>
            <p className="text-sm text-zinc-500">Contact us to upgrade.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-zinc-700">
                Plan: {PLAN_LABELS[subscription.plan] ?? subscription.plan}
              </p>
              <span
                className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[subscription.status] ?? 'bg-zinc-100 text-zinc-800'}`}
              >
                {subscription.status}
              </span>
              {subscription.currentPeriodEnd && (
                <p className="text-sm text-zinc-500">
                  Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            <form action={formAction}>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Redirecting…' : 'Manage billing'}
              </Button>
            </form>
            {state?.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
