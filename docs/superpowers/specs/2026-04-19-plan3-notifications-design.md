# Plan 3 — Notifications Design

**Date:** 2026-04-19  
**Scope:** Email (Resend) + SMS (Twilio) notifications for work order and maintenance schedule events, with per-user preference management and admin override UI.

---

## 1. Notification Events

### Work Order Events

| Event | Trigger point | Who is notified |
|---|---|---|
| `wo.assigned` | After `assignedToId` set on WO create or update | Assigned technician |
| `wo.status_changed` | After WO status update | Assigned technician + WO creator (if different user) |
| `wo.due_soon` | PM cron, 24h before `dueDate` | Assigned technician |
| `wo.overdue` | PM cron, past `dueDate` with status not COMPLETED/CANCELLED | Assigned technician + all MANAGERs/ADMINs in tenant |

### Maintenance Schedule Events

| Event | Trigger point | Who is notified |
|---|---|---|
| `schedule.due_soon` | PM cron, 24h before `nextDueDate` | All MANAGERs/ADMINs in tenant |
| `schedule.overdue` | PM cron, past `nextDueDate` with no WO generated | All MANAGERs/ADMINs in tenant |

Both schedule events are evaluated inside the existing `/api/cron/pm-check` handler — no additional cron job is needed.

---

## 2. Architecture

### New Files

**`lib/services/notifications.ts`**  
Core notification dispatcher. Signature: `sendNotification(userId: string, event: NotificationEvent, payload: NotificationPayload): Promise<void>`. Fetches the user's `NotificationPreference` record, then dispatches to email and/or SMS based on the `email`/`sms` booleans. Wrapped in try/catch — failures are logged but never thrown.

**`lib/notifications/templates.ts`**  
Maps each event type to `{ subject: string; emailBody: string; smsBody: string }`. All templates receive a typed `payload` (WO id, asset name, due date, etc.) for interpolation.

**`lib/notifications/resend.ts`**  
Thin wrapper: `sendEmail(to: string, subject: string, body: string): Promise<void>`. Initializes Resend client from `RESEND_API_KEY`.

**`lib/notifications/twilio.ts`**  
Thin wrapper: `sendSms(to: string, body: string): Promise<void>`. Initializes Twilio client from `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN`, sends from `TWILIO_FROM_NUMBER`.

### Modified Files

**`lib/services/workOrders.ts`**  
- `createWorkOrder` — call `sendNotification` for `wo.assigned` if `assignedToId` is set
- `updateWorkOrder` — call `sendNotification` for `wo.assigned` when `assignedToId` changes; call for `wo.status_changed` when `status` changes
- `createWorkOrder` / `updateWorkOrder` creator notification: fetch WO creator from `WorkOrderActivity` (first `created` event) and notify if different from assignee

**`lib/services/cron.ts`**  
- After the PM WO-generation pass, query **all active WOs across all tenants** for due_soon/overdue checks
- `wo.due_soon`: WOs with `dueDate` within the next 24h and status OPEN or IN_PROGRESS
- `wo.overdue`: WOs with `dueDate` in the past and status OPEN or IN_PROGRESS
- `schedule.due_soon`: schedules with `nextDueDate` within the next 24h and status `active`
- `schedule.overdue`: schedules with `nextDueDate` in the past and status `active` (cron failed to run previously)
- Fetch MANAGERs/ADMINs per tenant for tenant-wide notifications

### New UI Pages

**`/settings/profile`** (all roles)  
User can toggle their own email/SMS notification preferences and update their phone number. Backed by `PATCH /api/users/[id]` (extend existing route) and a new `PATCH /api/users/[id]/notification-prefs` route.

**`/settings/users`** (ADMIN + MANAGER only)  
Lists all active users in the tenant. Each row shows name, email, role, and email/SMS toggles. Admins can toggle any user's preferences. Uses the existing `GET /api/users` route and the new notification-prefs PATCH route.

### New API Route

**`PATCH /api/users/[id]/notification-prefs`**  
Body: `{ email?: boolean; sms?: boolean }`. Tenant-scoped. Users can only update their own prefs; ADMINs/MANAGERs can update any user in the tenant.

---

## 3. Schema Changes

None required. The existing models already provide everything needed:

- `User.phone` — used as the SMS `to` address
- `NotificationPreference.email` / `.sms` — channel toggles per user

`NotificationPreference` records are created on first access (upsert) to avoid requiring a migration that backfills existing users.

---

## 4. Environment Variables

Add to `.env.example`:

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

---

## 5. Error Handling

- Every `sendNotification()` call is wrapped in try/catch inside the notification service itself.
- Failures log to `console.error` with the event type and user id.
- Failures never propagate — the parent mutation (WO create, status update, cron run) always succeeds regardless of notification outcome.
- SMS is skipped silently if the user has no `phone` set, even if `sms` preference is `true`.

---

## 6. Testing

**`tests/services/notifications.test.ts`** (new)  
- Mock Resend and Twilio wrappers
- Assert email sent when `NotificationPreference.email = true`
- Assert SMS sent when `NotificationPreference.sms = true` and user has phone
- Assert SMS skipped when user has no phone
- Assert neither sent when both prefs are false
- Assert failure in Resend/Twilio does not throw

**`tests/notifications/templates.test.ts`** (new)  
- Assert each event type produces non-empty subject, emailBody, smsBody
- Assert payload values are interpolated correctly

**`tests/services/workOrders.test.ts`** (extend)  
- Mock `sendNotification`, assert called with `wo.assigned` on create with assignee
- Assert called with `wo.status_changed` on status update
- Assert not called when no assignee set

**`tests/services/cron.test.ts`** (extend)  
- Assert `wo.due_soon` and `wo.overdue` notifications fired for qualifying WOs
- Assert `schedule.due_soon` and `schedule.overdue` fired for qualifying schedules
