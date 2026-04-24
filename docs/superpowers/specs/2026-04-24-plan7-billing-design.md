# Plan 7: Billing & Subscription UI Design

## Goal

Wire the existing `Subscription` model to a billing settings page where ADMIN users can view their current plan and open the Stripe billing portal to manage or cancel their subscription.

## Scope

- Billing settings page at `/settings/billing` (ADMIN only)
- Display current plan name, status, and renewal date
- "Manage billing" button → server action → Stripe billing portal session → redirect
- "No plan" state with "Contact us to upgrade" message when `Subscription` is null
- Sidebar link for billing page

**Out of scope:** Stripe Checkout (new subscriptions), webhooks, subscription enforcement/gating, any non-ADMIN visibility.

## Architecture

Four new units:

### `lib/services/billing.ts`
Single responsibility: read the subscription record from the database.

```ts
getSubscription(tenantId: string): Promise<Subscription | null>
```

No Stripe calls. Returns the Prisma `Subscription` row or null.

### `lib/actions/billing.ts`
Single responsibility: create a Stripe billing portal session and redirect.

Server action `createPortalSession(): Promise<{ error: string } | never>`:
1. Reads auth session — returns `{ error: 'Unauthorized' }` if caller is not ADMIN
2. Calls `getSubscription(tenantId)` — returns `{ error: 'No subscription found' }` if null
3. Calls `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url })` — returns `{ error: message }` on Stripe failure
4. Calls `redirect(session.url)` on success (never returns normally)

`return_url` is `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`.

The action never throws — it returns `{ error: string }` for all failure cases so `BillingManager` can display the message inline.

### `components/settings/BillingManager.tsx`
Client component. Receives `Subscription | null` as a prop.

**Display states:**

| State | Rendered content |
|---|---|
| `null` | Plan: "No plan" · "Contact us to upgrade" · no button |
| `plan: 'starter'` | Plan: "Starter" · status badge · renewal date · "Manage billing" button |
| `plan: 'pro'` | Plan: "Pro" · status badge · renewal date · "Manage billing" button |

Status badge colours: `active` → green, `past_due` → yellow, `canceled` → red, other → gray.

Button is a `<form action={createPortalSession}><button type="submit">`. Uses `useActionState` to receive the `{ error: string }` return value; displays the error inline below the button on failure.

### `app/(dashboard)/settings/billing/page.tsx`
ADMIN-only server component. Redirects non-ADMINs to `/settings`. Calls `getSubscription(tenantId)` and renders `<BillingManager subscription={subscription} />`.

### `components/layout/Sidebar.tsx`
Add `CreditCard` icon entry for `/settings/billing` (same pattern as existing Clients link).

## Data Flow

```
ADMIN visits /settings/billing
  → page.tsx: auth check, redirect non-ADMIN
  → getSubscription(tenantId) → Subscription | null
  → BillingManager rendered with subscription prop

ADMIN clicks "Manage billing"
  → form submit → createPortalSession() server action
  → auth check (ADMIN guard)
  → getSubscription → stripeCustomerId
  → stripe.billingPortal.sessions.create({ customer, return_url })
  → redirect(session.url)
  → [Stripe portal]
  → user returns to /settings/billing
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API calls (server action only) |
| `NEXT_PUBLIC_APP_URL` | Builds `return_url` for portal session |

## Testing

### `tests/services/billing.test.ts`
- Returns subscription when found for tenant
- Returns null when no subscription exists

### `tests/actions/billing.test.ts`
- Returns `{ error: 'Unauthorized' }` when caller is not ADMIN
- Returns `{ error: 'No subscription found' }` when no subscription exists for tenant
- Calls `stripe.billingPortal.sessions.create` with correct `customer` and `return_url`, then redirects (Stripe SDK mocked; `redirect` mocked to capture the URL)

### `components/settings/BillingManager.tsx`
No unit tests — pure rendering, no logic.

## Files Created / Modified

| File | Action |
|---|---|
| `lib/services/billing.ts` | Create |
| `lib/actions/billing.ts` | Create |
| `components/settings/BillingManager.tsx` | Create |
| `app/(dashboard)/settings/billing/page.tsx` | Create |
| `components/layout/Sidebar.tsx` | Modify — add Billing link |
| `tests/services/billing.test.ts` | Create |
| `tests/actions/billing.test.ts` | Create |
