# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email (Resend) + SMS (Twilio) notifications for work order and schedule events, with per-user preference management and an admin override UI.

**Architecture:** A core `sendNotification(userId, event, payload)` dispatcher in `lib/services/notifications.ts` fetches the user's `NotificationPreference` and dispatches to thin Resend and Twilio wrappers. Notification calls are added inline to the existing `workOrders` and `cron` services. Failures are caught and logged — they never propagate to the caller.

**Tech Stack:** Resend SDK (`resend`), Twilio SDK (`twilio`), Vitest for tests, Next.js App Router API routes, React server + client component pattern.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/notifications/resend.ts` | Create | Resend SDK wrapper — `sendEmail(to, subject, body)` |
| `lib/notifications/twilio.ts` | Create | Twilio SDK wrapper — `sendSms(to, body)` |
| `lib/notifications/templates.ts` | Create | Maps event types to subject + email/SMS body strings |
| `lib/services/notifications.ts` | Create | Core dispatcher — fetches prefs, calls wrappers |
| `lib/services/workOrders.ts` | Modify | Add `sendNotification` calls on assign + status change |
| `lib/services/cron.ts` | Modify | Add due_soon/overdue notification checks |
| `lib/services/users.ts` | Modify | Add `listUsersWithPrefs` for admin settings page |
| `app/api/users/[id]/route.ts` | Create | PATCH user name/phone |
| `app/api/users/[id]/notification-prefs/route.ts` | Create | PATCH email/SMS preference toggles |
| `app/(dashboard)/settings/page.tsx` | Create | Profile settings server page |
| `app/(dashboard)/settings/users/page.tsx` | Create | Admin user-prefs server page |
| `components/settings/ProfileForm.tsx` | Create | Client form: name, phone, email/SMS toggles |
| `components/settings/UserPrefsTable.tsx` | Create | Client table: admin toggles per-user prefs |
| `tests/notifications/templates.test.ts` | Create | Template coverage per event type |
| `tests/services/notifications.test.ts` | Create | Dispatcher routing, error isolation |
| `tests/services/workOrders.test.ts` | Modify | Assert sendNotification called on assign/status change |
| `tests/services/cron.test.ts` | Modify | Assert sendNotification called for due_soon/overdue |
| `.env.example` | Modify | Add RESEND_* and TWILIO_* vars |

---

### Task 1: Install packages, update env vars, and create channel wrappers

**Files:**
- Modify: `.env.example`
- Create: `lib/notifications/resend.ts`
- Create: `lib/notifications/twilio.ts`

- [ ] **Step 1: Install Resend and Twilio SDKs**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npm install resend twilio
```

Expected: packages added to `node_modules`, `package-lock.json` updated.

- [ ] **Step 2: Update .env.example**

Add to the bottom of `.env.example`:

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

- [ ] **Step 3: Create Resend wrapper**

Create `lib/notifications/resend.ts`:

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    text: body,
  })
}
```

- [ ] **Step 4: Create Twilio wrapper**

Create `lib/notifications/twilio.ts`:

```typescript
import twilio from 'twilio'

export async function sendSms(to: string, body: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to,
    body,
  })
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx tsc --noEmit
```

Expected: no errors related to the new files.

- [ ] **Step 6: Commit**

```bash
git add lib/notifications/resend.ts lib/notifications/twilio.ts .env.example package.json package-lock.json
git commit -m "feat: add Resend and Twilio notification channel wrappers"
```

---

### Task 2: Notification templates

**Files:**
- Create: `lib/notifications/templates.ts`
- Create: `tests/notifications/templates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/notifications/templates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from '@/lib/notifications/templates'

describe('renderTemplate', () => {
  it('renders wo.assigned', () => {
    const t = renderTemplate('wo.assigned', { workOrderId: 'WO-1', workOrderDescription: 'Fix HVAC' })
    expect(t.subject).toContain('WO-1')
    expect(t.emailBody).toContain('WO-1')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders wo.status_changed', () => {
    const t = renderTemplate('wo.status_changed', {
      workOrderId: 'WO-2',
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
    })
    expect(t.subject).toContain('WO-2')
    expect(t.emailBody).toContain('OPEN')
    expect(t.emailBody).toContain('IN_PROGRESS')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders wo.due_soon', () => {
    const t = renderTemplate('wo.due_soon', {
      workOrderId: 'WO-3',
      dueDate: '2026-04-20T06:00:00.000Z',
    })
    expect(t.subject).toContain('WO-3')
    expect(t.emailBody).toContain('WO-3')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders wo.overdue', () => {
    const t = renderTemplate('wo.overdue', {
      workOrderId: 'WO-4',
      dueDate: '2026-04-18T06:00:00.000Z',
    })
    expect(t.subject).toContain('WO-4')
    expect(t.emailBody).toContain('WO-4')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders schedule.due_soon', () => {
    const t = renderTemplate('schedule.due_soon', {
      scheduleName: 'Monthly HVAC',
      dueDate: '2026-04-20T06:00:00.000Z',
    })
    expect(t.subject).toContain('Monthly HVAC')
    expect(t.emailBody).toContain('Monthly HVAC')
    expect(t.smsBody).toBeTruthy()
  })

  it('renders schedule.overdue', () => {
    const t = renderTemplate('schedule.overdue', {
      scheduleName: 'Quarterly Pump Check',
      dueDate: '2026-04-17T06:00:00.000Z',
    })
    expect(t.subject).toContain('Quarterly Pump Check')
    expect(t.emailBody).toContain('Quarterly Pump Check')
    expect(t.smsBody).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/notifications/templates.test.ts
```

Expected: FAIL — `renderTemplate` not found.

- [ ] **Step 3: Create the templates module**

Create `lib/notifications/templates.ts`:

```typescript
export type NotificationEvent =
  | 'wo.assigned'
  | 'wo.status_changed'
  | 'wo.due_soon'
  | 'wo.overdue'
  | 'schedule.due_soon'
  | 'schedule.overdue'

export type NotificationPayload = {
  workOrderId?: string
  workOrderDescription?: string
  fromStatus?: string
  toStatus?: string
  dueDate?: string
  scheduleName?: string
}

type RenderedTemplate = {
  subject: string
  emailBody: string
  smsBody: string
}

export function renderTemplate(
  event: NotificationEvent,
  payload: NotificationPayload
): RenderedTemplate {
  switch (event) {
    case 'wo.assigned':
      return {
        subject: `Work order ${payload.workOrderId} assigned to you`,
        emailBody: `You have been assigned work order ${payload.workOrderId}${payload.workOrderDescription ? `: ${payload.workOrderDescription}` : ''}.`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} assigned to you.`,
      }
    case 'wo.status_changed':
      return {
        subject: `Work order ${payload.workOrderId} status updated`,
        emailBody: `Work order ${payload.workOrderId} status changed from ${payload.fromStatus} to ${payload.toStatus}.`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} is now ${payload.toStatus}.`,
      }
    case 'wo.due_soon':
      return {
        subject: `Work order ${payload.workOrderId} due soon`,
        emailBody: `Work order ${payload.workOrderId} is due within 24 hours (${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'soon'}).`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} due within 24 hours.`,
      }
    case 'wo.overdue':
      return {
        subject: `Work order ${payload.workOrderId} is overdue`,
        emailBody: `Work order ${payload.workOrderId} is overdue (was due ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'recently'}).`,
        smsBody: `MaintainIQ: WO ${payload.workOrderId} is overdue.`,
      }
    case 'schedule.due_soon':
      return {
        subject: `Maintenance schedule "${payload.scheduleName}" due soon`,
        emailBody: `The maintenance schedule "${payload.scheduleName}" is due within 24 hours (${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'soon'}).`,
        smsBody: `MaintainIQ: Schedule "${payload.scheduleName}" due within 24 hours.`,
      }
    case 'schedule.overdue':
      return {
        subject: `Maintenance schedule "${payload.scheduleName}" is overdue`,
        emailBody: `The maintenance schedule "${payload.scheduleName}" is overdue (was due ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString() : 'recently'}).`,
        smsBody: `MaintainIQ: Schedule "${payload.scheduleName}" is overdue.`,
      }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/notifications/templates.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/templates.ts tests/notifications/templates.test.ts
git commit -m "feat: add notification templates for all 6 event types"
```

---

### Task 3: Core notification dispatcher

**Files:**
- Create: `lib/services/notifications.ts`
- Create: `tests/services/notifications.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/notifications.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/notifications/resend', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/notifications/twilio', () => ({
  sendSms: vi.fn(),
}))

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/resend'
import { sendSms } from '@/lib/notifications/twilio'
import { sendNotification } from '@/lib/services/notifications'

const baseUser = {
  id: 'u1',
  email: 'tech@example.com',
  phone: '+15550001234',
}

beforeEach(() => vi.clearAllMocks())

describe('sendNotification', () => {
  it('sends email when email pref is true', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: false },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('sends sms when sms pref is true and phone is set', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(sendSms).toHaveBeenCalledOnce()
  })

  it('sends both when both prefs are true', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).toHaveBeenCalledOnce()
  })

  it('skips sms when sms pref is true but phone is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      phone: null,
      notificationPrefs: { email: false, sms: true },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('sends nothing when both prefs are false', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: false },
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('defaults to email-only when notificationPrefs is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: null,
    } as any)
    await sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })
    expect(sendEmail).toHaveBeenCalledOnce()
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('does not throw when user not found', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    await expect(sendNotification('missing', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })

  it('does not throw when sendEmail fails', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: true, sms: false },
    } as any)
    vi.mocked(sendEmail).mockRejectedValue(new Error('Resend down'))
    await expect(sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })

  it('does not throw when sendSms fails', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      ...baseUser,
      notificationPrefs: { email: false, sms: true },
    } as any)
    vi.mocked(sendSms).mockRejectedValue(new Error('Twilio down'))
    await expect(sendNotification('u1', 'wo.assigned', { workOrderId: 'WO-1' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/notifications.test.ts
```

Expected: FAIL — `sendNotification` not found.

- [ ] **Step 3: Implement the notification service**

Create `lib/services/notifications.ts`:

```typescript
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/resend'
import { sendSms } from '@/lib/notifications/twilio'
import { renderTemplate, type NotificationEvent, type NotificationPayload } from '@/lib/notifications/templates'

export type { NotificationEvent, NotificationPayload }

export async function sendNotification(
  userId: string,
  event: NotificationEvent,
  payload: NotificationPayload
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        phone: true,
        notificationPrefs: { select: { email: true, sms: true } },
      },
    })
    if (!user) return

    const prefs = user.notificationPrefs ?? { email: true, sms: false }
    const { subject, emailBody, smsBody } = renderTemplate(event, payload)

    if (prefs.email) {
      try {
        await sendEmail(user.email, subject, emailBody)
      } catch (err) {
        console.error(`[notifications] sendEmail failed for ${userId} event=${event}:`, err)
      }
    }

    if (prefs.sms && user.phone) {
      try {
        await sendSms(user.phone, smsBody)
      } catch (err) {
        console.error(`[notifications] sendSms failed for ${userId} event=${event}:`, err)
      }
    }
  } catch (err) {
    console.error(`[notifications] sendNotification failed for ${userId} event=${event}:`, err)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/notifications.test.ts
```

Expected: 9 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run
```

Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/services/notifications.ts tests/services/notifications.test.ts
git commit -m "feat: add core notification dispatcher with email/SMS routing"
```

---

### Task 4: Extend workOrders service with notifications

**Files:**
- Modify: `lib/services/workOrders.ts`
- Modify: `tests/services/workOrders.test.ts`

- [ ] **Step 1: Add new test cases to workOrders.test.ts**

At the top of `tests/services/workOrders.test.ts`, add a mock for notifications (after the existing `vi.mock('@/lib/db', ...)` block):

```typescript
vi.mock('@/lib/services/notifications', () => ({
  sendNotification: vi.fn(),
}))
```

Add this import after the existing imports:

```typescript
import { sendNotification } from '@/lib/services/notifications'
```

Also add `workOrderActivity: { create: vi.fn(), findFirst: vi.fn() }` to the db mock (update the existing mock to include `findFirst` on `workOrderActivity`):

```typescript
vi.mock('@/lib/db', () => ({
  db: {
    workOrder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workOrderItem: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    workOrderActivity: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
    },
  },
}))
```

Then add these new `describe` blocks at the end of the file:

```typescript
describe('createWorkOrder — notifications', () => {
  it('sends wo.assigned when assignedToId is set', async () => {
    vi.mocked(db.asset.findMany).mockResolvedValue([{ id: 'a1' }] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1', assignedToId: 'u2' } as any)
    await createWorkOrder(TENANT, USER, { type: 'CORRECTIVE', assetIds: ['a1'], assignedToId: 'u2' })
    expect(sendNotification).toHaveBeenCalledWith('u2', 'wo.assigned', expect.objectContaining({ workOrderId: 'w1' }))
  })

  it('does not send wo.assigned when no assignedToId', async () => {
    vi.mocked(db.asset.findMany).mockResolvedValue([{ id: 'a1' }] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1', assignedToId: null } as any)
    await createWorkOrder(TENANT, USER, { type: 'CORRECTIVE', assetIds: ['a1'] })
    expect(sendNotification).not.toHaveBeenCalled()
  })
})

describe('updateWorkOrder — notifications', () => {
  it('sends wo.assigned when assignedToId changes', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: null } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    await updateWorkOrder(TENANT, 'w1', USER, { assignedToId: 'u2' })
    expect(sendNotification).toHaveBeenCalledWith('u2', 'wo.assigned', expect.objectContaining({ workOrderId: 'w1' }))
  })

  it('does not send wo.assigned when assignedToId is unchanged', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    await updateWorkOrder(TENANT, 'w1', USER, { assignedToId: 'u2' })
    expect(sendNotification).not.toHaveBeenCalledWith('u2', 'wo.assigned', expect.anything())
  })

  it('sends wo.status_changed to assignee when status changes', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'IN_PROGRESS', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    vi.mocked(db.workOrderActivity.findFirst).mockResolvedValue({ userId: 'u3' } as any)
    await updateWorkOrder(TENANT, 'w1', USER, { status: 'IN_PROGRESS' })
    expect(sendNotification).toHaveBeenCalledWith('u2', 'wo.status_changed', expect.objectContaining({
      workOrderId: 'w1',
      fromStatus: 'OPEN',
      toStatus: 'IN_PROGRESS',
    }))
  })

  it('also notifies the creator when creator differs from assignee on status change', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'IN_PROGRESS', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    vi.mocked(db.workOrderActivity.findFirst).mockResolvedValue({ userId: 'u3' } as any)
    await updateWorkOrder(TENANT, 'w1', USER, { status: 'IN_PROGRESS' })
    expect(sendNotification).toHaveBeenCalledWith('u3', 'wo.status_changed', expect.objectContaining({ workOrderId: 'w1' }))
  })

  it('does not double-notify creator when creator is same as assignee', async () => {
    vi.mocked(db.workOrder.findFirst).mockResolvedValue({ id: 'w1', status: 'OPEN', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrder.update).mockResolvedValue({ id: 'w1', status: 'IN_PROGRESS', assignedToId: 'u2' } as any)
    vi.mocked(db.workOrderActivity.create).mockResolvedValue({} as any)
    vi.mocked(db.workOrderActivity.findFirst).mockResolvedValue({ userId: 'u2' } as any)
    await updateWorkOrder(TENANT, 'w1', USER, { status: 'IN_PROGRESS' })
    const calls = vi.mocked(sendNotification).mock.calls.filter(([uid, event]) => uid === 'u2' && event === 'wo.status_changed')
    expect(calls).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/workOrders.test.ts
```

Expected: existing tests PASS, new tests FAIL — `sendNotification` not called.

- [ ] **Step 3: Update workOrders service**

Replace the contents of `lib/services/workOrders.ts` with:

```typescript
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/services/notifications'
import type { WorkOrderStatus, WorkOrderType, Priority } from '@prisma/client'

type WorkOrderInput = {
  type: WorkOrderType
  priority?: Priority
  description?: string | null
  assignedToId?: string | null
  dueDate?: Date | null
  linkedScheduleId?: string | null
  assetIds: string[]
}

type WorkOrderUpdate = {
  priority?: Priority
  description?: string | null
  assignedToId?: string | null
  dueDate?: Date | null
  status?: WorkOrderStatus
}

type ItemUpdate = {
  notes?: string | null
  status?: string
}

export async function listWorkOrders(
  tenantId: string,
  filters?: {
    status?: WorkOrderStatus
    type?: WorkOrderType
    assignedToId?: string
  }
) {
  return db.workOrder.findMany({
    where: {
      tenantId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function getWorkOrder(tenantId: string, id: string) {
  return db.workOrder.findFirst({
    where: { id, tenantId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      items: {
        include: { asset: { select: { id: true, name: true } } },
      },
      activities: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true } } },
      },
      linkedSchedule: { select: { id: true, name: true } },
    },
  })
}

async function assertAssetsOwnedByTenant(tenantId: string, assetIds: string[]): Promise<void> {
  const owned = await db.asset.findMany({
    where: { id: { in: assetIds }, tenantId },
    select: { id: true },
  })
  if (owned.length !== assetIds.length) {
    throw Object.assign(new Error('One or more assets not found'), { code: 'P2025' })
  }
}

export async function createWorkOrder(
  tenantId: string,
  userId: string,
  data: WorkOrderInput
) {
  const { assetIds, ...rest } = data
  await assertAssetsOwnedByTenant(tenantId, assetIds)
  const wo = await db.workOrder.create({
    data: {
      ...rest,
      tenantId,
      items: {
        create: assetIds.map((assetId) => ({ assetId })),
      },
      activities: {
        create: {
          userId,
          eventType: 'CREATED',
          payload: {},
        },
      },
    },
  })

  if (wo.assignedToId) {
    await sendNotification(wo.assignedToId, 'wo.assigned', {
      workOrderId: wo.id,
      workOrderDescription: wo.description ?? undefined,
    })
  }

  return wo
}

export async function updateWorkOrder(
  tenantId: string,
  id: string,
  userId: string,
  data: WorkOrderUpdate
) {
  const existing = await db.workOrder.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true, assignedToId: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  const updated = await db.workOrder.update({
    where: { id },
    data: {
      ...data,
      ...(data.status === 'COMPLETED' && { completedAt: new Date() }),
    },
  })

  const assigneeChanged =
    data.assignedToId !== undefined &&
    data.assignedToId !== null &&
    data.assignedToId !== existing.assignedToId

  if (assigneeChanged) {
    await sendNotification(data.assignedToId!, 'wo.assigned', { workOrderId: id })
  }

  if (data.status && data.status !== existing.status) {
    await db.workOrderActivity.create({
      data: {
        workOrderId: id,
        userId,
        eventType: 'STATUS_CHANGED',
        payload: { from: existing.status, to: data.status },
      },
    })

    if (updated.assignedToId) {
      await sendNotification(updated.assignedToId, 'wo.status_changed', {
        workOrderId: id,
        fromStatus: existing.status,
        toStatus: data.status,
      })
    }

    const createdActivity = await db.workOrderActivity.findFirst({
      where: { workOrderId: id, eventType: 'CREATED' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    })
    if (createdActivity && createdActivity.userId !== updated.assignedToId) {
      await sendNotification(createdActivity.userId, 'wo.status_changed', {
        workOrderId: id,
        fromStatus: existing.status,
        toStatus: data.status,
      })
    }
  }

  return updated
}

export async function updateWorkOrderItem(
  tenantId: string,
  workOrderId: string,
  itemId: string,
  userId: string,
  data: ItemUpdate
) {
  const workOrder = await db.workOrder.findFirst({
    where: { id: workOrderId, tenantId },
    include: { items: { select: { id: true, status: true } } },
  })
  if (!workOrder) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  await db.workOrderItem.update({ where: { id: itemId, workOrderId }, data })

  const siblings = await db.workOrderItem.findMany({
    where: { workOrderId },
    select: { id: true, status: true },
  })

  let newWoStatus: WorkOrderStatus | undefined
  if (data.status === 'in_progress' && workOrder.status === 'OPEN') {
    newWoStatus = 'IN_PROGRESS'
  } else if (
    data.status === 'completed' &&
    siblings.every((item) => item.status === 'completed')
  ) {
    newWoStatus = 'COMPLETED'
  }

  if (newWoStatus) {
    await db.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: newWoStatus,
        ...(newWoStatus === 'COMPLETED' && { completedAt: new Date() }),
      },
    })
    await db.workOrderActivity.create({
      data: {
        workOrderId,
        userId,
        eventType: 'STATUS_CHANGED',
        payload: { from: workOrder.status, to: newWoStatus },
      },
    })
  }

  await db.workOrderActivity.create({
    data: {
      workOrderId,
      userId,
      eventType: 'ITEM_UPDATED',
      payload: { itemId, changes: data },
    },
  })

  return db.workOrder.findFirst({
    where: { id: workOrderId },
    include: {
      items: { include: { asset: { select: { id: true, name: true } } } },
    },
  })
}

export async function cancelWorkOrder(
  tenantId: string,
  id: string,
  userId: string
) {
  const existing = await db.workOrder.findFirst({
    where: { id, tenantId },
    select: { id: true, status: true },
  })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })

  if (existing.status === 'CANCELLED') return existing as any

  const updated = await db.workOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  await db.workOrderActivity.create({
    data: {
      workOrderId: id,
      userId,
      eventType: 'STATUS_CHANGED',
      payload: { from: existing.status, to: 'CANCELLED' },
    },
  })

  return updated
}
```

- [ ] **Step 4: Run tests to confirm they all pass**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/workOrders.test.ts
```

Expected: all tests PASS (including the 5 new ones).

- [ ] **Step 5: Run full test suite**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/services/workOrders.ts tests/services/workOrders.test.ts
git commit -m "feat: send notifications on work order assign and status change"
```

---

### Task 5: Extend cron service with due_soon/overdue notifications

**Files:**
- Modify: `lib/services/cron.ts`
- Modify: `tests/services/cron.test.ts`

- [ ] **Step 1: Add notification mock and new test cases to cron.test.ts**

Replace the entire contents of `tests/services/cron.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/services/notifications', () => ({
  sendNotification: vi.fn(),
}))

vi.mock('@/lib/db', () => {
  const workOrderCreate = vi.fn()
  const workOrderFindMany = vi.fn()
  const scheduleUpdate = vi.fn()
  const scheduleFindMany = vi.fn()
  const userFindMany = vi.fn()

  return {
    db: {
      maintenanceSchedule: {
        findMany: scheduleFindMany,
        update: scheduleUpdate,
      },
      workOrder: {
        create: workOrderCreate,
        findMany: workOrderFindMany,
      },
      user: {
        findMany: userFindMany,
      },
      $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) =>
        fn({
          workOrder: { create: workOrderCreate },
          maintenanceSchedule: { update: scheduleUpdate },
        })
      ),
    },
  }
})

import { db } from '@/lib/db'
import { sendNotification } from '@/lib/services/notifications'
import { runPmCheck } from '@/lib/services/cron'

beforeEach(() => vi.clearAllMocks())

// ─── Existing tests (unchanged) ───────────────────────────────────────────────

describe('runPmCheck', () => {
  it('returns 0 when no schedules are due', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])
    const result = await runPmCheck()
    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('only queries time_based schedules', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])
    await runPmCheck()
    expect(db.maintenanceSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ triggerType: 'time_based' }),
      })
    )
  })

  it('creates a PREVENTIVE work order for each due schedule', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    const result = await runPmCheck()

    expect(result).toEqual({ generated: 1 })
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          type: 'PREVENTIVE',
          status: 'OPEN',
          linkedScheduleId: 's1',
          items: { create: [{ assetId: 'a1' }] },
        }),
      })
    )
  })

  it('advances nextDueDate by days interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 30,
        intervalUnit: 'days',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4)
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('advances nextDueDate by months interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const call = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    expect(call.where).toEqual({ id: 's1' })
    expect(call.data.nextDueDate.getDate()).toBe(1)
    expect(call.data.nextDueDate.getMonth()).toBe(4)
    expect(call.data.nextDueDate.getFullYear()).toBe(2026)
  })

  it('skips schedules with no assets', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate: new Date('2026-04-01'),
        intervalValue: 7,
        intervalUnit: 'days',
        assets: [],
      },
    ] as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    const result = await runPmCheck()

    expect(result).toEqual({ generated: 0 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it('advances nextDueDate by weeks interval', async () => {
    const nextDueDate = new Date(2026, 3, 1)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 2,
        intervalUnit: 'weeks',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const expectedNext = new Date(2026, 3, 15)
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: { nextDueDate: expectedNext },
      })
    )
  })

  it('clamps month-end overflow (Jan 31 + 1 month = Feb 28)', async () => {
    const nextDueDate = new Date(2026, 0, 31)
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([
      {
        id: 's1',
        tenantId: 't1',
        triggerType: 'time_based',
        nextDueDate,
        intervalValue: 1,
        intervalUnit: 'months',
        assets: [{ assetId: 'a1' }],
      },
    ] as any)
    vi.mocked(db.workOrder.create).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.maintenanceSchedule.update).mockResolvedValue({} as any)
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    const updateCall = vi.mocked(db.maintenanceSchedule.update).mock.calls[0][0]
    const nextDate = (updateCall as any).data.nextDueDate
    expect(nextDate.getMonth()).toBe(1)
    expect(nextDate.getDate()).toBeLessThanOrEqual(28)
  })
})

// ─── Notification tests ────────────────────────────────────────────────────────

describe('runPmCheck — wo.due_soon notifications', () => {
  it('sends wo.due_soon to assigned technician for WOs due within 24h', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany)
      .mockResolvedValueOnce([
        { id: 'w1', assignedToId: 'u1', dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000) },
      ] as any) // due_soon WOs
      .mockResolvedValueOnce([]) // overdue WOs
    vi.mocked(db.user.findMany).mockResolvedValue([])

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u1', 'wo.due_soon', expect.objectContaining({ workOrderId: 'w1' }))
  })
})

describe('runPmCheck — wo.overdue notifications', () => {
  it('sends wo.overdue to assigned technician and tenant admins', async () => {
    vi.mocked(db.maintenanceSchedule.findMany).mockResolvedValue([])
    vi.mocked(db.workOrder.findMany)
      .mockResolvedValueOnce([]) // due_soon WOs
      .mockResolvedValueOnce([
        { id: 'w2', tenantId: 't1', assignedToId: 'u1', dueDate: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      ] as any) // overdue WOs
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any) // tenant admins

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u1', 'wo.overdue', expect.objectContaining({ workOrderId: 'w2' }))
    expect(sendNotification).toHaveBeenCalledWith('u2', 'wo.overdue', expect.objectContaining({ workOrderId: 'w2' }))
  })
})

describe('runPmCheck — schedule.due_soon notifications', () => {
  it('sends schedule.due_soon to tenant admins for schedules due within 24h', async () => {
    vi.mocked(db.maintenanceSchedule.findMany)
      .mockResolvedValueOnce([]) // due schedules (for WO generation)
      .mockResolvedValueOnce([
        { id: 's1', tenantId: 't1', name: 'Monthly HVAC', nextDueDate: new Date(Date.now() + 12 * 60 * 60 * 1000) },
      ] as any) // due_soon schedules
      .mockResolvedValueOnce([]) // overdue schedules
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any)

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u2', 'schedule.due_soon', expect.objectContaining({ scheduleName: 'Monthly HVAC' }))
  })
})

describe('runPmCheck — schedule.overdue notifications', () => {
  it('sends schedule.overdue to tenant admins for overdue active schedules', async () => {
    vi.mocked(db.maintenanceSchedule.findMany)
      .mockResolvedValueOnce([]) // due schedules (for WO generation)
      .mockResolvedValueOnce([]) // due_soon schedules
      .mockResolvedValueOnce([
        { id: 's2', tenantId: 't1', name: 'Quarterly Pump', nextDueDate: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      ] as any) // overdue schedules
    vi.mocked(db.workOrder.findMany).mockResolvedValue([])
    vi.mocked(db.user.findMany).mockResolvedValue([{ id: 'u2' }] as any)

    await runPmCheck()

    expect(sendNotification).toHaveBeenCalledWith('u2', 'schedule.overdue', expect.objectContaining({ scheduleName: 'Quarterly Pump' }))
  })
})
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/cron.test.ts
```

Expected: existing tests PASS, new notification tests FAIL.

- [ ] **Step 3: Update cron service**

Replace the contents of `lib/services/cron.ts` with:

```typescript
import { db } from '@/lib/db'
import { sendNotification } from '@/lib/services/notifications'

function advanceDueDate(
  current: Date,
  intervalValue: number,
  intervalUnit: string | null
): Date {
  const next = new Date(current)
  switch (intervalUnit) {
    case 'weeks':
      next.setDate(next.getDate() + intervalValue * 7)
      break
    case 'months': {
      const day = next.getDate()
      next.setMonth(next.getMonth() + intervalValue)
      // Clamp to last day of target month if overflow occurred (e.g. Jan 31 + 1 month)
      if (next.getDate() !== day) {
        next.setDate(0) // day 0 = last day of previous month
      }
      break
    }
    default: // 'days' or null
      next.setDate(next.getDate() + intervalValue)
      break
  }
  return next
}

export async function runPmCheck(): Promise<{ generated: number }> {
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // ── WO generation pass ────────────────────────────────────────────────────
  const dueSchedules = await db.maintenanceSchedule.findMany({
    where: { status: 'active', triggerType: 'time_based', nextDueDate: { lte: now } },
    include: { assets: { select: { assetId: true } } },
  })

  let generated = 0

  for (const schedule of dueSchedules) {
    if (schedule.assets.length === 0) continue

    const nextDue = advanceDueDate(
      schedule.nextDueDate,
      schedule.intervalValue,
      schedule.intervalUnit
    )

    try {
      await db.$transaction(async (tx) => {
        await tx.workOrder.create({
          data: {
            tenantId: schedule.tenantId,
            type: 'PREVENTIVE',
            status: 'OPEN',
            priority: 'MEDIUM',
            linkedScheduleId: schedule.id,
            items: {
              create: schedule.assets.map(({ assetId }) => ({ assetId })),
            },
          },
        })

        await tx.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { nextDueDate: nextDue },
        })
      })
      generated++
    } catch (err) {
      console.error(`[pm-check] Failed to process schedule ${schedule.id}:`, err)
    }
  }

  // ── WO due_soon notifications ─────────────────────────────────────────────
  const dueSoonWOs = await db.workOrder.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueDate: { gt: now, lte: tomorrow },
      assignedToId: { not: null },
    },
    select: { id: true, assignedToId: true, dueDate: true },
  })
  for (const wo of dueSoonWOs) {
    await sendNotification(wo.assignedToId!, 'wo.due_soon', {
      workOrderId: wo.id,
      dueDate: wo.dueDate!.toISOString(),
    })
  }

  // ── WO overdue notifications ──────────────────────────────────────────────
  const overdueWOs = await db.workOrder.findMany({
    where: {
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueDate: { lt: now },
      assignedToId: { not: null },
    },
    select: { id: true, tenantId: true, assignedToId: true, dueDate: true },
  })
  for (const wo of overdueWOs) {
    await sendNotification(wo.assignedToId!, 'wo.overdue', {
      workOrderId: wo.id,
      dueDate: wo.dueDate!.toISOString(),
    })
    const admins = await db.user.findMany({
      where: {
        tenantId: wo.tenantId,
        role: { in: ['ADMIN', 'MANAGER'] },
        active: true,
        NOT: { id: wo.assignedToId! },
      },
      select: { id: true },
    })
    for (const admin of admins) {
      await sendNotification(admin.id, 'wo.overdue', {
        workOrderId: wo.id,
        dueDate: wo.dueDate!.toISOString(),
      })
    }
  }

  // ── Schedule due_soon notifications ───────────────────────────────────────
  const dueSoonSchedules = await db.maintenanceSchedule.findMany({
    where: {
      status: 'active',
      triggerType: 'time_based',
      nextDueDate: { gt: now, lte: tomorrow },
    },
    select: { id: true, tenantId: true, name: true, nextDueDate: true },
  })
  for (const schedule of dueSoonSchedules) {
    const admins = await db.user.findMany({
      where: { tenantId: schedule.tenantId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
      select: { id: true },
    })
    for (const admin of admins) {
      await sendNotification(admin.id, 'schedule.due_soon', {
        scheduleName: schedule.name,
        dueDate: schedule.nextDueDate.toISOString(),
      })
    }
  }

  // ── Schedule overdue notifications ────────────────────────────────────────
  const overdueSchedules = await db.maintenanceSchedule.findMany({
    where: {
      status: 'active',
      triggerType: 'time_based',
      nextDueDate: { lt: now },
    },
    select: { id: true, tenantId: true, name: true, nextDueDate: true },
  })
  for (const schedule of overdueSchedules) {
    const admins = await db.user.findMany({
      where: { tenantId: schedule.tenantId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
      select: { id: true },
    })
    for (const admin of admins) {
      await sendNotification(admin.id, 'schedule.overdue', {
        scheduleName: schedule.name,
        dueDate: schedule.nextDueDate.toISOString(),
      })
    }
  }

  return { generated }
}
```

- [ ] **Step 4: Run cron tests to confirm they all pass**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run tests/services/cron.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/services/cron.ts tests/services/cron.test.ts
git commit -m "feat: add due_soon and overdue notifications to PM cron"
```

---

### Task 6: Notification-prefs API routes

**Files:**
- Create: `app/api/users/[id]/route.ts`
- Create: `app/api/users/[id]/notification-prefs/route.ts`

- [ ] **Step 1: Create user PATCH route (name/phone)**

Create `app/api/users/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/tenant'

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser()
    const { id } = await params

    if (sessionUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const updated = await db.user.update({
      where: { id, tenantId: sessionUser.tenantId },
      data: parsed.data,
      select: { id: true, name: true, email: true, phone: true },
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create notification-prefs PATCH route**

Create `app/api/users/[id]/notification-prefs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/tenant'

const PrefsSchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser()
    const { id } = await params

    const canEdit =
      sessionUser.id === id ||
      ['ADMIN', 'MANAGER'].includes(sessionUser.role)

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Confirm target user belongs to same tenant
    const targetUser = await db.user.findFirst({
      where: { id, tenantId: sessionUser.tenantId },
      select: { id: true },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PrefsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const prefs = await db.notificationPreference.upsert({
      where: { userId: id },
      update: parsed.data,
      create: { userId: id, email: true, sms: false, ...parsed.data },
    })

    return NextResponse.json(prefs)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/users/[id]/route.ts app/api/users/[id]/notification-prefs/route.ts
git commit -m "feat: add PATCH user and notification-prefs API routes"
```

---

### Task 7: Add listUsersWithPrefs to users service

**Files:**
- Modify: `lib/services/users.ts`

- [ ] **Step 1: Add listUsersWithPrefs**

Append to `lib/services/users.ts`:

```typescript
export async function listUsersWithPrefs(tenantId: string) {
  return db.user.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      notificationPrefs: { select: { email: true, sms: true } },
    },
    orderBy: { name: 'asc' },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/services/users.ts
git commit -m "feat: add listUsersWithPrefs for admin settings page"
```

---

### Task 8: Settings profile page (personal prefs)

**Files:**
- Create: `components/settings/ProfileForm.tsx`
- Create: `app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create the ProfileForm client component**

Create `components/settings/ProfileForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
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
      const profileRes = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone: phone || null }),
      })
      const prefsRes = await fetch(`/api/users/${user.id}/notification-prefs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailPref, sms: smsPref }),
      })
      if (profileRes.ok && prefsRes.ok) {
        setMessage('Saved.')
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
        {message && <p className="text-sm text-zinc-500">{message}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the settings server page**

Create `app/(dashboard)/settings/page.tsx`:

```tsx
import { getSessionUser } from '@/lib/tenant'
import { db } from '@/lib/db'
import { ProfileForm } from '@/components/settings/ProfileForm'

export default async function SettingsPage() {
  const sessionUser = await getSessionUser()
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      notificationPrefs: { select: { email: true, sms: true } },
    },
  })

  return <ProfileForm user={user!} />
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/settings/ProfileForm.tsx app/(dashboard)/settings/page.tsx
git commit -m "feat: add settings profile page with notification preference toggles"
```

---

### Task 9: Settings users admin page

**Files:**
- Create: `components/settings/UserPrefsTable.tsx`
- Create: `app/(dashboard)/settings/users/page.tsx`

- [ ] **Step 1: Create the UserPrefsTable client component**

Create `components/settings/UserPrefsTable.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the settings/users server page**

Create `app/(dashboard)/settings/users/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { listUsersWithPrefs } from '@/lib/services/users'
import { UserPrefsTable } from '@/components/settings/UserPrefsTable'

export default async function SettingsUsersPage() {
  const sessionUser = await getSessionUser()

  if (!['ADMIN', 'MANAGER'].includes(sessionUser.role)) {
    redirect('/settings')
  }

  const users = await listUsersWithPrefs(sessionUser.tenantId)

  return <UserPrefsTable users={users} sessionUserId={sessionUser.id} />
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd /home/bobby/Dev/claude/projects/maintenance-saas
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/settings/UserPrefsTable.tsx app/(dashboard)/settings/users/page.tsx
git commit -m "feat: add team settings page for admin notification preference management"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| Email via Resend | Task 1 (resend.ts) + Task 3 (dispatcher) |
| SMS via Twilio | Task 1 (twilio.ts) + Task 3 (dispatcher) |
| `wo.assigned` on create | Task 4 |
| `wo.assigned` on update (assignee change) | Task 4 |
| `wo.status_changed` to assignee + creator | Task 4 |
| `wo.due_soon` via cron | Task 5 |
| `wo.overdue` to assignee + tenant admins via cron | Task 5 |
| `schedule.due_soon` to tenant admins via cron | Task 5 |
| `schedule.overdue` to tenant admins via cron | Task 5 |
| Failures non-fatal (try/catch, log only) | Task 3 |
| SMS skipped if no phone | Task 3 |
| `NotificationPreference` upsert on prefs PATCH | Task 6 |
| User updates own phone + prefs | Tasks 6 + 8 |
| Admin/Manager overrides any user's prefs | Tasks 6 + 9 |
| New env vars in `.env.example` | Task 1 |
