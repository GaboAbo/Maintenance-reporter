# Plan 7: Billing & Subscription UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `Subscription` Prisma model to a billing settings page where ADMIN users can view their current plan status and open the Stripe billing portal to manage or cancel their subscription.

**Architecture:** A dedicated `lib/services/billing.ts` reads the subscription from the DB; a `lib/actions/billing.ts` server action creates a Stripe billing portal session and redirects; `components/settings/BillingManager.tsx` is a client component that displays plan status and hosts the form; `app/(dashboard)/settings/billing/page.tsx` is an ADMIN-only server component that fetches and renders it. The `Subscription` model already exists in the schema — no migration needed.

**Tech Stack:** Next.js 16 App Router, React 19 `useActionState`, Stripe Node.js SDK, Prisma 7, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/stripe.ts` | Create | Stripe singleton client |
| `lib/services/billing.ts` | Create | `getSubscription(tenantId)` — DB read only |
| `lib/actions/billing.ts` | Create | `createPortalSession` server action — Stripe portal session + redirect |
| `components/settings/BillingManager.tsx` | Create | Client UI: plan display, portal button, error state |
| `app/(dashboard)/settings/billing/page.tsx` | Create | ADMIN-only server component; fetches subscription, renders BillingManager |
| `components/layout/Sidebar.tsx` | Modify | Add Billing nav link with `CreditCard` icon |
| `tests/services/billing.test.ts` | Create | 2 tests for `getSubscription` |
| `tests/actions/billing.test.ts` | Create | 3 tests for `createPortalSession` |

---

## Task 1: Install Stripe SDK and create singleton

**Files:**
- Create: `lib/stripe.ts`

- [ ] **Step 1: Install stripe**

```bash
npm install stripe
```

Expected: stripe appears in `package.json` dependencies.

- [ ] **Step 2: Create the Stripe singleton**

```typescript
// lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-01-27.acacia',
})
```

> If TypeScript rejects the `apiVersion` string, open `node_modules/stripe/types/stripe.d.ts`, find the `ApiVersion` type, and use the latest value listed there.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/stripe.ts package.json package-lock.json
git commit -m "chore: install stripe sdk and add singleton client"
```

---

## Task 2: Billing service and tests

**Files:**
- Create: `lib/services/billing.ts`
- Create: `tests/services/billing.test.ts`

The `Subscription` model has `tenantId String @unique`, so `findUnique({ where: { tenantId } })` is the correct query.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/services/billing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    subscription: {
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { getSubscription } from '@/lib/services/billing'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('getSubscription', () => {
  it('returns subscription when found', async () => {
    const sub = {
      id: 's1',
      tenantId: TENANT,
      stripeCustomerId: 'cus_123',
      plan: 'starter',
      status: 'active',
      currentPeriodEnd: null,
    }
    vi.mocked(db.subscription.findUnique).mockResolvedValue(sub as any)
    const result = await getSubscription(TENANT)
    expect(result).toEqual(sub)
    expect(db.subscription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } })
    )
  })

  it('returns null when no subscription exists', async () => {
    vi.mocked(db.subscription.findUnique).mockResolvedValue(null)
    const result = await getSubscription(TENANT)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/services/billing.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/billing'`

- [ ] **Step 3: Implement the service**

```typescript
// lib/services/billing.ts
import { db } from '@/lib/db'

export type SubscriptionEntry = {
  id: string
  tenantId: string
  stripeCustomerId: string
  plan: string
  status: string
  currentPeriodEnd: Date | null
}

const SELECT = {
  id: true,
  tenantId: true,
  stripeCustomerId: true,
  plan: true,
  status: true,
  currentPeriodEnd: true,
}

export async function getSubscription(tenantId: string): Promise<SubscriptionEntry | null> {
  return db.subscription.findUnique({
    where: { tenantId },
    select: SELECT,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/services/billing.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/services/billing.ts tests/services/billing.test.ts
git commit -m "feat: add billing service with getSubscription"
```

---

## Task 3: Billing server action and tests

**Files:**
- Create: `lib/actions/billing.ts`
- Create: `tests/actions/billing.test.ts`

The server action uses `useActionState`-compatible signature: `(prevState, formData) => Promise<{ error: string } | null>`. On success it calls `redirect()` (which in Next.js throws `NEXT_REDIRECT` — the framework handles it). On failure it returns `{ error: string }`.

In tests, `redirect` is mocked as a no-op `vi.fn()` so execution continues past it; we assert it was called with the correct URL.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/actions/billing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/tenant', () => ({
  getSessionUser: vi.fn(),
}))

vi.mock('@/lib/services/billing', () => ({
  getSubscription: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { getSessionUser } from '@/lib/tenant'
import { getSubscription } from '@/lib/services/billing'
import { stripe } from '@/lib/stripe'
import { redirect } from 'next/navigation'
import { createPortalSession } from '@/lib/actions/billing'

beforeEach(() => vi.clearAllMocks())

describe('createPortalSession', () => {
  it('returns error when caller is not ADMIN', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'MANAGER', tenantId: 't1' } as any)
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'Unauthorized' })
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('returns error when no subscription exists', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'ADMIN', tenantId: 't1' } as any)
    vi.mocked(getSubscription).mockResolvedValue(null)
    const result = await createPortalSession(null, new FormData())
    expect(result).toEqual({ error: 'No subscription found' })
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled()
  })

  it('creates portal session and redirects on success', async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ role: 'ADMIN', tenantId: 't1' } as any)
    vi.mocked(getSubscription).mockResolvedValue({ stripeCustomerId: 'cus_123' } as any)
    vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
      url: 'https://billing.stripe.com/p/session_xxx',
    } as any)

    await createPortalSession(null, new FormData())

    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: expect.stringContaining('/settings/billing'),
    })
    expect(redirect).toHaveBeenCalledWith('https://billing.stripe.com/p/session_xxx')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/actions/billing.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/actions/billing'`

- [ ] **Step 3: Implement the server action**

```typescript
// lib/actions/billing.ts
'use server'

import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { getSubscription } from '@/lib/services/billing'
import { stripe } from '@/lib/stripe'

export async function createPortalSession(
  _prev: { error: string } | null,
  _formData: FormData
): Promise<{ error: string } | null> {
  let user
  try {
    user = await getSessionUser()
  } catch {
    return { error: 'Unauthorized' }
  }

  if (user.role !== 'ADMIN') return { error: 'Unauthorized' }

  const subscription = await getSubscription(user.tenantId)
  if (!subscription) return { error: 'No subscription found' }

  let sessionUrl: string
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    })
    sessionUrl = session.url
  } catch (err: any) {
    return { error: err.message ?? 'Failed to create billing session' }
  }

  redirect(sessionUrl)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/actions/billing.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all tests pass (previously 123).

- [ ] **Step 6: Commit**

```bash
git add lib/actions/billing.ts tests/actions/billing.test.ts
git commit -m "feat: add createPortalSession server action for Stripe billing portal"
```

---

## Task 4: BillingManager component

**Files:**
- Create: `components/settings/BillingManager.tsx`

This is a client component (`'use client'`). It uses React 19's `useActionState` to wire the server action to the form and display errors inline. When `subscription` is null, it shows a "no plan" state with no button.

Status badge colours: `active` → green, `past_due` → yellow, `canceled` → red, anything else → gray.

- [ ] **Step 1: Create the component**

```tsx
// components/settings/BillingManager.tsx
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
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/settings/BillingManager.tsx
git commit -m "feat: add BillingManager component"
```

---

## Task 5: Billing settings page and sidebar link

**Files:**
- Create: `app/(dashboard)/settings/billing/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

The page follows the exact same ADMIN-guard + server-fetch + component pattern as `app/(dashboard)/settings/clients/page.tsx`. The sidebar adds a `CreditCard` import and entry to `NAV_ITEMS`, placed between Clients and Settings.

- [ ] **Step 1: Create the billing settings page**

```tsx
// app/(dashboard)/settings/billing/page.tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { getSubscription } from '@/lib/services/billing'
import { BillingManager } from '@/components/settings/BillingManager'

export default async function BillingSettingsPage() {
  const user = await getSessionUser()
  if (user.role !== 'ADMIN') redirect('/settings')

  const subscription = await getSubscription(user.tenantId)

  return <BillingManager subscription={subscription} />
}
```

- [ ] **Step 2: Add Billing link to the sidebar**

Open `components/layout/Sidebar.tsx`. The current imports line is:

```typescript
import { LayoutDashboard, Wrench, ClipboardList, Calendar, Users, Tag, Building2, Settings } from 'lucide-react'
```

Change it to:

```typescript
import { LayoutDashboard, Wrench, ClipboardList, Calendar, Users, Tag, Building2, CreditCard, Settings } from 'lucide-react'
```

The current `NAV_ITEMS` array ends with:

```typescript
  { href: '/settings/clients', label: 'Clients', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
```

Change it to:

```typescript
  { href: '/settings/clients', label: 'Clients', icon: Building2 },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass (128 total — 2 service tests from Task 2 + 3 action tests from Task 3).

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/settings/billing/page.tsx components/layout/Sidebar.tsx
git commit -m "feat: add billing settings page and sidebar link"
```

---

## Done

Plan 7 complete. The billing settings page is at `/settings/billing`. ADMIN users can view their plan and open the Stripe billing portal via server action. Non-ADMINs are redirected to `/settings`. Tenants with no subscription see a "Contact us to upgrade" message.

**Env vars required before using in production:**
- `STRIPE_SECRET_KEY` — Stripe secret key (never expose to client)
- `NEXT_PUBLIC_APP_URL` — e.g. `https://yourdomain.com` (used as Stripe return URL)
