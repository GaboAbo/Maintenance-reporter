# Plan 6: Client Reports Design

## Goal

Allow ADMIN users to manage a list of clients (external stakeholders), associate assets with those clients, and automatically send each client a scoped PDF maintenance report every Monday covering their assets and the work orders performed on them in the past 7 days. ADMINs can also trigger a send manually at any time.

## Architecture

A new `Client` model stores per-tenant contacts. Assets gain an optional `clientId` FK. A report generation service uses `@react-pdf/renderer` to build a PDF in memory. A delivery service emails that PDF via Resend (already integrated in Plan 3). A Vercel cron route fires every Monday to dispatch reports for all tenants. A manual send endpoint gives ADMINs on-demand control.

## Tech Stack

Next.js 16 App Router, Prisma 7, TypeScript, `@react-pdf/renderer`, Resend, Vitest, Tailwind CSS, shadcn/ui.

---

## Data Model

### New `Client` model

```prisma
model Client {
  id             String   @id @default(cuid())
  tenantId       String
  name           String
  email          String
  receivesReport Boolean  @default(false)
  createdAt      DateTime @default(now())
  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assets         Asset[]

  @@unique([tenantId, email])
  @@index([tenantId])
}
```

### `Asset` changes

Add two fields to the existing `Asset` model:

```prisma
clientId String?
client   Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` — assets are not deleted when a client is deleted; they become unassigned.

### `Tenant` changes

Add reverse relation:

```prisma
clients Client[]
```

---

## Services

### `lib/services/clients.ts`

- `listClients(tenantId): Promise<ClientEntry[]>` — returns all clients for the tenant ordered by name
- `createClient(tenantId, name, email): Promise<ClientEntry>` — validates no duplicate email per tenant (DUPLICATE error), creates record
- `deleteClient(tenantId, clientId): Promise<void>` — validates exists + belongs to tenant (NOT_FOUND), blocks if client has assigned assets (IN_USE error with count), deletes
- `toggleReportRecipient(tenantId, clientId, receives: boolean): Promise<ClientEntry>` — sets `receivesReport` flag

`ClientEntry` type: `{ id, tenantId, name, email, receivesReport, createdAt }`

Error codes follow established project pattern: `Object.assign(new Error('msg'), { code: 'CODE' })`.

### `lib/services/report-generator.ts`

- `generateClientReportPdf(params: ReportParams): Promise<Buffer>` — renders a PDF using `@react-pdf/renderer` and returns it as a Node `Buffer`

`ReportParams`:
```typescript
type ReportParams = {
  tenantName: string
  client: { name: string; email: string }
  periodStart: Date   // previous Monday 00:00 UTC
  periodEnd: Date     // previous Sunday 23:59 UTC
  assets: Array<{ name: string; category: string | null; location: string | null; status: string }>
  workOrders: Array<{ title: string; type: string; status: string; technicianName: string | null; completedAt: Date | null }>
}
```

PDF structure:
1. **Header** — tenant name, client name, report period (e.g. "Apr 14 – Apr 20, 2026")
2. **Summary** — total assets, WOs opened this week, WOs completed this week
3. **Assets table** — Name, Category, Location, Status
4. **Work orders table** — Title, Type, Status, Technician, Completed

### `lib/services/report-delivery.ts`

- `sendReportsForTenant(tenantId): Promise<{ sent: number; skipped: number }>` — fetches all clients where `receivesReport = true`, fetches tenant name, fetches each client's assets + their work orders in the last 7 days, generates PDF, sends via Resend with the PDF as an attachment. Returns counts for logging.
- `sendAllTenantReports(): Promise<void>` — iterates all tenants and calls `sendReportsForTenant` for each; used by the cron route.

Reuses the existing Resend client from `lib/email.ts` (Plan 3).

---

## API Routes

### `GET /api/clients`
Returns all clients for the authenticated tenant. Any authenticated role.

### `POST /api/clients`
Body: `{ name: string, email: string }`. ADMIN only. Returns 201 on success, 409 on duplicate email.

### `PATCH /api/clients/[id]`
Body: `{ receivesReport: boolean }`. ADMIN only. Toggles the report recipient flag. Returns 200.

### `DELETE /api/clients/[id]`
ADMIN only. Returns 204 on success, 404 if not found, 409 if client has assigned assets.

### `POST /api/reports/send`
ADMIN only. Triggers `sendReportsForTenant` for the current tenant immediately. Returns `{ sent, skipped }`. 200 on success.

### `GET /api/cron/weekly-report`
No session auth — secured by `Authorization: Bearer ${CRON_SECRET}` header check. Calls `sendAllTenantReports()`. Returns 200. Configured in `vercel.json` to run every Monday at 08:00 UTC.

---

## UI

### `/settings/clients` — server page (ADMIN only)

Redirects non-ADMINs to `/settings`. Fetches all clients via `listClients`. Renders `<ClientManager>`.

### `components/settings/ClientManager.tsx` — client component

- Table of clients: Name, Email, Receives Report (toggle), Delete button
- "Receives report" is a checkbox/toggle per row; toggling calls `PATCH /api/clients/[id]`
- Delete button is blocked (grayed, shows count) if client has assigned assets
- Add form: Name field + Email field + Add button
- "Send reports now" button at the top; calls `POST /api/reports/send`; shows "Sending…" then success count or error

### `AssetForm` update

Gains a "Client" dropdown (same `<Select>` pattern as Category). New and edit asset pages fetch clients via `listClients(tenantId)` and pass them as a prop.

### `AssetTable` + asset detail page

Display `client?.name` in a new column / detail row, same pattern as `category?.name`.

### Sidebar

Add "Clients" link to `/settings/clients` in `components/layout/Sidebar.tsx`.

---

## `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

---

## Environment Variables

- `CRON_SECRET` — random secret string; set in Vercel env vars. The cron route rejects requests that don't include `Authorization: Bearer <CRON_SECRET>`.

---

## Testing

- `tests/services/clients.test.ts` — unit tests for `listClients`, `createClient` (success, duplicate email), `deleteClient` (success, not found, in-use), `toggleReportRecipient`
- `tests/services/report-generator.test.ts` — unit tests verifying `generateClientReportPdf` returns a non-empty Buffer and includes expected text content
- `tests/services/report-delivery.test.ts` — unit tests for `sendReportsForTenant` (mocking db + Resend): sends to enabled clients only, skips clients with no assets, returns correct counts
- Existing asset service tests updated for `clientId`

---

## What's Out of Scope

- Per-client customization of report content or branding
- Report history / audit log
- Email open tracking
- Configurable report schedule (always Monday 08:00 UTC)
- Multi-language support
