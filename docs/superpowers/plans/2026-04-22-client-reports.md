# Client Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow ADMIN users to manage a list of clients, associate assets with those clients, and automatically email each client a scoped PDF maintenance report every Monday covering their assets and work orders.

**Architecture:** A new `Client` model stores per-tenant contacts. Assets gain an optional `clientId` FK. A `@react-pdf/renderer`-based generator builds a PDF Buffer in a Next.js API route. A delivery service emails that PDF via the existing Resend integration. A Vercel cron route fires every Monday at 08:00 UTC; a manual send button lets ADMINs trigger delivery on demand.

**Tech Stack:** Next.js 16 App Router, Prisma 7, TypeScript, `@react-pdf/renderer`, Resend, Vitest, Tailwind CSS, shadcn/ui.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `Client` model; add `clientId` FK to `Asset`; add `clients` relation to `Tenant` |
| `lib/services/clients.ts` | Create | `listClients`, `createClient`, `deleteClient`, `toggleReportRecipient` |
| `tests/services/clients.test.ts` | Create | Unit tests for clients service |
| `app/api/clients/route.ts` | Create | GET + POST clients |
| `app/api/clients/[id]/route.ts` | Create | PATCH (toggle) + DELETE client |
| `lib/services/assets.ts` | Modify | Add `clientId` to `AssetInput`; include `client` relation in `listAssets` and `getAsset` |
| `tests/services/assets.test.ts` | Modify | Add `clientId` passthrough test |
| `app/api/assets/route.ts` | Modify | Add `clientId` to `AssetSchema` |
| `app/api/assets/[id]/route.ts` | Modify | Add `clientId` to `UpdateAssetSchema` |
| `components/assets/AssetForm.tsx` | Modify | Add `clientId` state + Client `<Select>` dropdown; accept `clients` prop |
| `app/(dashboard)/assets/new/page.tsx` | Modify | Fetch clients and pass to `AssetForm` |
| `app/(dashboard)/assets/[id]/edit/page.tsx` | Modify | Fetch clients and pass to `AssetForm` |
| `components/assets/AssetTable.tsx` | Modify | Add Client column |
| `app/(dashboard)/assets/[id]/page.tsx` | Modify | Display `client?.name` in details grid |
| `lib/services/report-generator.tsx` | Create | `generateClientReportPdf` — renders PDF with `@react-pdf/renderer` |
| `tests/services/report-generator.test.ts` | Create | Verifies PDF generation returns Buffer |
| `lib/notifications/resend.ts` | Modify | Add `sendEmailWithAttachment` |
| `lib/services/report-delivery.ts` | Create | `sendReportsForTenant`, `sendAllTenantReports` |
| `tests/services/report-delivery.test.ts` | Create | Unit tests for report delivery |
| `app/api/reports/send/route.ts` | Create | POST — manual trigger (ADMIN only) |
| `app/api/cron/weekly-report/route.ts` | Create | GET — cron endpoint (CRON_SECRET) |
| `vercel.json` | Modify | Add weekly-report cron schedule |
| `components/settings/ClientManager.tsx` | Create | Client CRUD + report toggle + send-now button |
| `app/(dashboard)/settings/clients/page.tsx` | Create | ADMIN-only server page |
| `components/layout/Sidebar.tsx` | Modify | Add Clients link |

---

## Task 1: Schema — Client model and Asset.clientId

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Make three changes:

**1. Add `clients Client[]` to `Tenant` model** (after `assetCategories` line):
```prisma
clients         Client[]
```

**2. Add `clientId` FK to `Asset` model** (after `categoryId`/`category` lines):
```prisma
clientId String?
client   Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)
```

**3. Add new `Client` model** (after the `AssetCategory` model block):
```prisma
model Client {
  id             String   @id @default(cuid())
  tenantId       String
  name           String
  email          String
  receivesReport Boolean  @default(false)
  createdAt      DateTime @default(now())

  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assets Asset[]

  @@unique([tenantId, email])
  @@index([tenantId])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_client_model
```

Expected output includes: `✔  Generated Prisma Client` and a new migration file in `prisma/migrations/`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Client model and clientId FK to Asset"
```

---

## Task 2: Clients service and tests

**Files:**
- Create: `lib/services/clients.ts`
- Create: `tests/services/clients.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/clients.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    client: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { listClients, createClient, deleteClient, toggleReportRecipient } from '@/lib/services/clients'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listClients', () => {
  it('queries by tenantId', async () => {
    vi.mocked(db.client.findMany).mockResolvedValue([])
    await listClients(TENANT)
    expect(db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } })
    )
  })
})

describe('createClient', () => {
  it('creates and returns new client', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    const client = { id: 'c1', tenantId: TENANT, name: 'Acme Corp', email: 'acme@example.com', receivesReport: false, createdAt: new Date() }
    vi.mocked(db.client.create).mockResolvedValue(client as any)
    const result = await createClient(TENANT, 'Acme Corp', 'acme@example.com')
    expect(result.name).toBe('Acme Corp')
    expect(db.client.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tenantId: TENANT, name: 'Acme Corp', email: 'acme@example.com' } })
    )
  })

  it('throws DUPLICATE when email already exists for tenant', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1' } as any)
    await expect(createClient(TENANT, 'Acme', 'acme@example.com')).rejects.toMatchObject({ code: 'DUPLICATE' })
    expect(db.client.create).not.toHaveBeenCalled()
  })
})

describe('deleteClient', () => {
  it('deletes client when no assets assigned', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(0)
    vi.mocked(db.client.delete).mockResolvedValue({} as any)
    await deleteClient(TENANT, 'c1')
    expect(db.client.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('throws NOT_FOUND when client does not exist', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    await expect(deleteClient(TENANT, 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when client belongs to different tenant', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: 'other' } as any)
    await expect(deleteClient(TENANT, 'c1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws IN_USE with count when assets are assigned', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(2)
    const err = await deleteClient(TENANT, 'c1').catch((e) => e)
    expect(err).toMatchObject({ code: 'IN_USE' })
    expect(err.count).toBe(2)
  })
})

describe('toggleReportRecipient', () => {
  it('updates receivesReport flag', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue({ id: 'c1', tenantId: TENANT } as any)
    const updated = { id: 'c1', tenantId: TENANT, name: 'Acme', email: 'a@b.com', receivesReport: true, createdAt: new Date() }
    vi.mocked(db.client.update).mockResolvedValue(updated as any)
    const result = await toggleReportRecipient(TENANT, 'c1', true)
    expect(result.receivesReport).toBe(true)
    expect(db.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' }, data: { receivesReport: true } })
    )
  })

  it('throws NOT_FOUND when client does not exist', async () => {
    vi.mocked(db.client.findFirst).mockResolvedValue(null)
    await expect(toggleReportRecipient(TENANT, 'x', true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/services/clients.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/clients'`

- [ ] **Step 3: Create `lib/services/clients.ts`**

```typescript
import { db } from '@/lib/db'

export type ClientEntry = {
  id: string
  tenantId: string
  name: string
  email: string
  receivesReport: boolean
  createdAt: Date
}

const SELECT = { id: true, tenantId: true, name: true, email: true, receivesReport: true, createdAt: true }

export async function listClients(tenantId: string): Promise<ClientEntry[]> {
  return db.client.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: SELECT,
  })
}

export async function createClient(tenantId: string, name: string, email: string): Promise<ClientEntry> {
  const existing = await db.client.findFirst({ where: { tenantId, email } })
  if (existing) throw Object.assign(new Error('A client with this email already exists'), { code: 'DUPLICATE' })
  return db.client.create({
    data: { tenantId, name, email },
    select: SELECT,
  })
}

export async function deleteClient(tenantId: string, clientId: string): Promise<void> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, tenantId: true },
  })
  if (!client) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })
  if (client.tenantId !== tenantId) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })

  const assetCount = await db.asset.count({ where: { clientId } })
  if (assetCount > 0) {
    throw Object.assign(
      new Error(`Client has ${assetCount} assigned asset(s)`),
      { code: 'IN_USE', count: assetCount }
    )
  }

  await db.client.delete({ where: { id: clientId } })
}

export async function toggleReportRecipient(tenantId: string, clientId: string, receives: boolean): Promise<ClientEntry> {
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: { id: true, tenantId: true },
  })
  if (!client) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })
  if (client.tenantId !== tenantId) throw Object.assign(new Error('Client not found'), { code: 'NOT_FOUND' })

  return db.client.update({
    where: { id: clientId },
    data: { receivesReport: receives },
    select: SELECT,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/clients.test.ts
```

Expected: 8 tests, all PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/services/clients.ts tests/services/clients.test.ts
git commit -m "feat: add clients service with list, create, delete, and toggle"
```

---

## Task 3: Clients API routes

**Files:**
- Create: `app/api/clients/route.ts`
- Create: `app/api/clients/[id]/route.ts`

- [ ] **Step 1: Create `app/api/clients/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { listClients, createClient } from '@/lib/services/clients'

const CreateClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
})

export async function GET() {
  try {
    const user = await getSessionUser()
    const clients = await listClients(user.tenantId)
    return NextResponse.json(clients)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CreateClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const client = await createClient(user.tenantId, parsed.data.name, parsed.data.email)
    return NextResponse.json(client, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'DUPLICATE') return NextResponse.json({ error: 'A client with this email already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/clients/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { deleteClient, toggleReportRecipient } from '@/lib/services/clients'

const PatchClientSchema = z.object({
  receivesReport: z.boolean(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PatchClientSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    }

    const client = await toggleReportRecipient(user.tenantId, id, parsed.data.receivesReport)
    return NextResponse.json(client)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'NOT_FOUND') return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await deleteClient(user.tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'NOT_FOUND') return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    if (err.code === 'IN_USE') return NextResponse.json({ error: err.message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/route.ts app/api/clients/[id]/route.ts
git commit -m "feat: add clients API routes (GET, POST, PATCH, DELETE)"
```

---

## Task 4: Update assets service and API for clientId

**Files:**
- Modify: `lib/services/assets.ts`
- Modify: `tests/services/assets.test.ts`
- Modify: `app/api/assets/route.ts`
- Modify: `app/api/assets/[id]/route.ts`

- [ ] **Step 1: Update `lib/services/assets.ts`**

Replace the file with:

```typescript
import { db } from '@/lib/db'
import type { AssetStatus } from '@prisma/client'

type AssetInput = {
  name: string
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  location?: string | null
  categoryId?: string | null
  clientId?: string | null
  status?: AssetStatus
  installationDate?: Date | null
  warrantyExpiry?: Date | null
}

export async function listAssets(tenantId: string) {
  return db.asset.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { workOrderItems: true } },
      category: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
  })
}

export async function getAsset(tenantId: string, id: string) {
  return db.asset.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      workOrderItems: {
        include: { workOrder: { select: { id: true, type: true, status: true, createdAt: true } } },
        orderBy: { workOrder: { createdAt: 'desc' } },
        take: 10,
      },
      scheduleAssets: {
        include: { schedule: true },
      },
    },
  })
}

export async function createAsset(tenantId: string, data: AssetInput) {
  return db.asset.create({
    data: { ...data, tenantId, status: data.status ?? 'ACTIVE' },
  })
}

export async function updateAsset(tenantId: string, id: string, data: Partial<AssetInput>) {
  const existing = await db.asset.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  return db.asset.update({ where: { id }, data })
}

export async function decommissionAsset(tenantId: string, id: string) {
  const existing = await db.asset.findFirst({ where: { id, tenantId }, select: { id: true } })
  if (!existing) throw Object.assign(new Error('Not found'), { code: 'P2025' })
  return db.asset.update({ where: { id }, data: { status: 'DECOMMISSIONED' } })
}
```

- [ ] **Step 2: Add `clientId` test to `tests/services/assets.test.ts`**

Find the `describe('createAsset', ...)` block (around line 49) and add after the existing tests:

```typescript
  it('passes clientId when provided', async () => {
    vi.mocked(db.asset.create).mockResolvedValue({ id: 'a1' } as any)
    await createAsset(TENANT, { name: 'Pump', clientId: 'cl1' })
    expect(db.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: 'cl1' }) })
    )
  })
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/services/assets.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Add `clientId` to `app/api/assets/route.ts` schema**

In `AssetSchema`, add after the `categoryId` line:

```typescript
clientId: z.string().optional().nullable(),
```

- [ ] **Step 5: Add `clientId` to `app/api/assets/[id]/route.ts` schema**

In `UpdateAssetSchema`, add after the `categoryId` line:

```typescript
clientId: z.string().optional().nullable(),
```

- [ ] **Step 6: Run all tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/services/assets.ts tests/services/assets.test.ts app/api/assets/route.ts app/api/assets/\[id\]/route.ts
git commit -m "feat: add clientId to assets service and API"
```

---

## Task 5: Update AssetForm and new/edit pages

**Files:**
- Modify: `components/assets/AssetForm.tsx`
- Modify: `app/(dashboard)/assets/new/page.tsx`
- Modify: `app/(dashboard)/assets/[id]/edit/page.tsx`

- [ ] **Step 1: Replace `components/assets/AssetForm.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AssetStatus } from '@prisma/client'
import type { CategoryEntry } from '@/lib/services/categories'
import type { ClientEntry } from '@/lib/services/clients'

type AssetFormAsset = {
  id: string
  name: string
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  location?: string | null
  categoryId?: string | null
  clientId?: string | null
  status: AssetStatus
}

type AssetFormProps = {
  asset?: AssetFormAsset
  categories: CategoryEntry[]
  clients: ClientEntry[]
}

export function AssetForm({ asset, categories, clients }: AssetFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'ACTIVE')
  const [categoryId, setCategoryId] = useState<string>(asset?.categoryId ?? 'none')
  const [clientId, setClientId] = useState<string>(asset?.clientId ?? 'none')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(e.currentTarget)

    const body = {
      name: form.get('name'),
      serialNumber: form.get('serialNumber') || null,
      model: form.get('model') || null,
      manufacturer: form.get('manufacturer') || null,
      location: form.get('location') || null,
      categoryId: categoryId === 'none' ? null : categoryId,
      clientId: clientId === 'none' ? null : clientId,
      status,
    }

    const url = asset ? `/api/assets/${asset.id}` : '/api/assets'
    const method = asset ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let msg = 'Failed to save asset'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch {}
        setError(msg)
        return
      }

      router.push('/assets')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" defaultValue={asset?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serialNumber">Serial number</Label>
          <Input id="serialNumber" name="serialNumber" defaultValue={asset?.serialNumber ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" defaultValue={asset?.model ?? ''} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input id="manufacturer" name="manufacturer" defaultValue={asset?.manufacturer ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="category">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={asset?.location ?? ''} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger id="client">
              <SelectValue placeholder="No client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as AssetStatus)}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="DECOMMISSIONED">Decommissioned</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : asset ? 'Update asset' : 'Create asset'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/assets')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Replace `app/(dashboard)/assets/new/page.tsx`**

```tsx
import { AssetForm } from '@/components/assets/AssetForm'
import { getTenantId } from '@/lib/tenant'
import { listCategories } from '@/lib/services/categories'
import { listClients } from '@/lib/services/clients'

export default async function NewAssetPage() {
  const tenantId = await getTenantId()
  const [categories, clients] = await Promise.all([
    listCategories(tenantId),
    listClients(tenantId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New asset</h1>
        <p className="text-sm text-zinc-500">Add a piece of equipment to your asset registry.</p>
      </div>
      <AssetForm categories={categories} clients={clients} />
    </div>
  )
}
```

- [ ] **Step 3: Replace `app/(dashboard)/assets/[id]/edit/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { AssetForm } from '@/components/assets/AssetForm'
import { getTenantId } from '@/lib/tenant'
import { getAsset } from '@/lib/services/assets'
import { listCategories } from '@/lib/services/categories'
import { listClients } from '@/lib/services/clients'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = await getTenantId()
  const [asset, categories, clients] = await Promise.all([
    getAsset(tenantId, id),
    listCategories(tenantId),
    listClients(tenantId),
  ])

  if (!asset) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit asset</h1>
        <p className="text-sm text-zinc-500">{asset.name}</p>
      </div>
      <AssetForm asset={asset} categories={categories} clients={clients} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/assets/AssetForm.tsx "app/(dashboard)/assets/new/page.tsx" "app/(dashboard)/assets/[id]/edit/page.tsx"
git commit -m "feat: add client dropdown to AssetForm"
```

---

## Task 6: Update AssetTable and asset detail page

**Files:**
- Modify: `components/assets/AssetTable.tsx`
- Modify: `app/(dashboard)/assets/[id]/page.tsx`

- [ ] **Step 1: Replace `components/assets/AssetTable.tsx`**

```tsx
import Link from 'next/link'
import { AssetStatusBadge } from './AssetStatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Asset } from '@prisma/client'

type AssetWithCountCategoryAndClient = Omit<Asset, 'category'> & {
  _count: { workOrderItems: number }
  category: { id: string; name: string } | null
  client: { id: string; name: string } | null
}

export function AssetTable({ assets }: { assets: AssetWithCountCategoryAndClient[] }) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-500">No assets yet. Add your first asset to get started.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Work orders</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell>
              <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                {asset.name}
              </Link>
              {asset.serialNumber && (
                <div className="text-xs text-zinc-400">S/N: {asset.serialNumber}</div>
              )}
            </TableCell>
            <TableCell>{asset.category?.name ?? '—'}</TableCell>
            <TableCell>{asset.client?.name ?? '—'}</TableCell>
            <TableCell>{asset.location ?? '—'}</TableCell>
            <TableCell>
              <AssetStatusBadge status={asset.status} />
            </TableCell>
            <TableCell>{asset._count.workOrderItems}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

- [ ] **Step 2: Update `app/(dashboard)/assets/[id]/page.tsx`**

Add `'Client', asset.client?.name` to the details grid. Replace the file with:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge'
import { getTenantId } from '@/lib/tenant'
import { getAsset } from '@/lib/services/assets'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = await getTenantId()
  const asset = await getAsset(tenantId, id)

  if (!asset) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{asset.name}</h1>
          <div className="flex items-center gap-2">
            <AssetStatusBadge status={asset.status} />
            {asset.category?.name && (
              <span className="text-sm text-zinc-500">{asset.category.name}</span>
            )}
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/assets/${id}/edit`}>Edit</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 text-sm md:grid-cols-3">
        {[
          ['Serial number', asset.serialNumber],
          ['Model', asset.model],
          ['Manufacturer', asset.manufacturer],
          ['Location', asset.location],
          ['Client', asset.client?.name],
          ['Installed', asset.installationDate ? new Date(asset.installationDate).toLocaleDateString() : null],
          ['Warranty expires', asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : null],
        ].map(([label, value]) => (
          <div key={label as string}>
            <div className="font-medium text-zinc-500">{label}</div>
            <div>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Maintenance history</h2>
        {asset.workOrderItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No work orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {asset.workOrderItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-md border bg-white px-4 py-2 text-sm">
                <Link href={`/work-orders/${item.workOrderId}`} className="hover:underline">
                  {item.workOrder.type} — {item.workOrder.status}
                </Link>
                <span className="text-zinc-400">
                  {new Date(item.workOrder.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/assets/AssetTable.tsx "app/(dashboard)/assets/[id]/page.tsx"
git commit -m "feat: display client name in asset list and detail pages"
```

---

## Task 7: PDF report generator

**Files:**
- Create: `lib/services/report-generator.tsx`
- Create: `tests/services/report-generator.test.ts`

- [ ] **Step 1: Install `@react-pdf/renderer`**

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf
```

Note: `@types/react-pdf` may not exist; that's fine — `@react-pdf/renderer` ships its own types.

Run just:
```bash
npm install @react-pdf/renderer
```

Expected: package added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing test**

Create `tests/services/report-generator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
  Document: ({ children }: any) => children,
  Page: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  View: ({ children }: any) => children,
  StyleSheet: { create: (styles: any) => styles },
}))

import { generateClientReportPdf } from '@/lib/services/report-generator'
import { renderToBuffer } from '@react-pdf/renderer'

const PARAMS = {
  tenantName: 'Acme Maintenance',
  client: { name: 'Hospital ABC', email: 'facilities@hospital.com' },
  periodStart: new Date('2026-04-14T00:00:00Z'),
  periodEnd: new Date('2026-04-20T23:59:59Z'),
  assets: [
    { name: 'Boiler 1', category: 'HVAC', location: 'Basement', status: 'ACTIVE' },
  ],
  workOrders: [
    { type: 'PREVENTIVE', status: 'COMPLETED', description: 'Monthly inspection', technicianName: 'John', completedAt: new Date('2026-04-18') },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('generateClientReportPdf', () => {
  it('returns a Buffer', async () => {
    const result = await generateClientReportPdf(PARAMS)
    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('calls renderToBuffer', async () => {
    await generateClientReportPdf(PARAMS)
    expect(renderToBuffer).toHaveBeenCalledOnce()
  })

  it('handles empty assets and work orders', async () => {
    const result = await generateClientReportPdf({ ...PARAMS, assets: [], workOrders: [] })
    expect(Buffer.isBuffer(result)).toBe(true)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- tests/services/report-generator.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/report-generator'`

- [ ] **Step 4: Create `lib/services/report-generator.tsx`**

```tsx
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 24 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#666' },
  period: { fontSize: 10, color: '#888', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20, marginTop: 16 },
  statBox: { flex: 1, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4 },
  statValue: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  statLabel: { fontSize: 9, color: '#666', marginTop: 2 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  table: { width: '100%' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', paddingVertical: 6, paddingHorizontal: 8 },
  tableHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#444' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tableCell: { fontSize: 9 },
  col35: { width: '35%' },
  col25: { width: '25%' },
  col20: { width: '20%' },
  col15: { width: '15%' },
  empty: { color: '#999', fontSize: 9, fontStyle: 'italic' },
})

export type ReportParams = {
  tenantName: string
  client: { name: string; email: string }
  periodStart: Date
  periodEnd: Date
  assets: Array<{ name: string; category: string | null; location: string | null; status: string }>
  workOrders: Array<{
    type: string
    status: string
    description: string | null
    technicianName: string | null
    completedAt: Date | null
  }>
}

function fmt(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ReportDocument({ tenantName, client, periodStart, periodEnd, assets, workOrders }: ReportParams) {
  const completed = workOrders.filter((wo) => wo.status === 'COMPLETED').length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{client.name}</Text>
          <Text style={styles.subtitle}>Maintenance Report — {tenantName}</Text>
          <Text style={styles.period}>Period: {fmt(periodStart)} – {fmt(periodEnd)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{assets.length}</Text>
            <Text style={styles.statLabel}>Assets</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{workOrders.length}</Text>
            <Text style={styles.statLabel}>Work orders</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assets</Text>
          {assets.length === 0 ? (
            <Text style={styles.empty}>No assets assigned.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Name</Text>
                <Text style={[styles.tableHeaderCell, styles.col25]}>Category</Text>
                <Text style={[styles.tableHeaderCell, styles.col25]}>Location</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Status</Text>
              </View>
              {assets.map((asset, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col35]}>{asset.name}</Text>
                  <Text style={[styles.tableCell, styles.col25]}>{asset.category ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col25]}>{asset.location ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{asset.status}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Orders (this period)</Text>
          {workOrders.length === 0 ? (
            <Text style={styles.empty}>No work orders in this period.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col35]}>Description</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Type</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Status</Text>
                <Text style={[styles.tableHeaderCell, styles.col20]}>Technician</Text>
                <Text style={[styles.tableHeaderCell, styles.col15]}>Completed</Text>
              </View>
              {workOrders.map((wo, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col35]}>{wo.description ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{wo.type}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{wo.status}</Text>
                  <Text style={[styles.tableCell, styles.col20]}>{wo.technicianName ?? '—'}</Text>
                  <Text style={[styles.tableCell, styles.col15]}>{fmt(wo.completedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}

export async function generateClientReportPdf(params: ReportParams): Promise<Buffer> {
  return renderToBuffer(<ReportDocument {...params} />)
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/services/report-generator.test.ts
```

Expected: 3 tests, all PASS.

- [ ] **Step 6: Run full suite**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/services/report-generator.tsx tests/services/report-generator.test.ts package.json package-lock.json
git commit -m "feat: add PDF report generator using @react-pdf/renderer"
```

---

## Task 8: Email attachment support and report delivery service

**Files:**
- Modify: `lib/notifications/resend.ts`
- Create: `lib/services/report-delivery.ts`
- Create: `tests/services/report-delivery.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/report-delivery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findMany: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
    },
    workOrderItem: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/notifications/resend', () => ({
  sendEmailWithAttachment: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/report-generator', () => ({
  generateClientReportPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-mock')),
}))

import { db } from '@/lib/db'
import { sendEmailWithAttachment } from '@/lib/notifications/resend'
import { generateClientReportPdf } from '@/lib/services/report-generator'
import { sendReportsForTenant, sendAllTenantReports } from '@/lib/services/report-delivery'

const TENANT_ID = 't1'

beforeEach(() => vi.clearAllMocks())

describe('sendReportsForTenant', () => {
  it('returns { sent: 0, skipped: 0 } when tenant not found', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 0, skipped: 0 })
    expect(sendEmailWithAttachment).not.toHaveBeenCalled()
  })

  it('skips clients with no assets', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Hospital', email: 'h@h.com' },
    ] as any)
    vi.mocked(db.asset.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 0, skipped: 1 })
    expect(sendEmailWithAttachment).not.toHaveBeenCalled()
  })

  it('sends email for clients with assets', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Hospital', email: 'h@h.com' },
    ] as any)
    vi.mocked(db.asset.findMany).mockResolvedValue([
      { id: 'a1', name: 'Boiler', category: null, location: null, status: 'ACTIVE' },
    ] as any)
    vi.mocked(db.workOrderItem.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 1, skipped: 0 })
    expect(generateClientReportPdf).toHaveBeenCalledOnce()
    expect(sendEmailWithAttachment).toHaveBeenCalledOnce()
    expect(sendEmailWithAttachment).toHaveBeenCalledWith(
      'h@h.com',
      expect.stringContaining('Acme'),
      expect.any(String),
      expect.objectContaining({ filename: expect.stringContaining('.pdf') })
    )
  })

  it('returns correct counts for mixed clients', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(db.client.findMany).mockResolvedValue([
      { id: 'c1', name: 'Client A', email: 'a@a.com' },
      { id: 'c2', name: 'Client B', email: 'b@b.com' },
    ] as any)
    vi.mocked(db.asset.findMany)
      .mockResolvedValueOnce([{ id: 'a1', name: 'Boiler', category: null, location: null, status: 'ACTIVE' }] as any)
      .mockResolvedValueOnce([])
    vi.mocked(db.workOrderItem.findMany).mockResolvedValue([])
    const result = await sendReportsForTenant(TENANT_ID)
    expect(result).toEqual({ sent: 1, skipped: 1 })
  })
})

describe('sendAllTenantReports', () => {
  it('calls sendReportsForTenant for each tenant', async () => {
    vi.mocked(db.tenant.findMany).mockResolvedValue([{ id: 't1' }, { id: 't2' }] as any)
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    vi.mocked(db.client.findMany).mockResolvedValue([])
    await sendAllTenantReports()
    expect(db.tenant.findUnique).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/services/report-delivery.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/services/report-delivery'`

- [ ] **Step 3: Add `sendEmailWithAttachment` to `lib/notifications/resend.ts`**

Append to the existing file (keep `sendEmail` as-is):

```typescript
export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  body: string,
  attachment: { filename: string; content: Buffer }
): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to,
    subject,
    text: body,
    attachments: [{ filename: attachment.filename, content: attachment.content }],
  })
  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
```

- [ ] **Step 4: Create `lib/services/report-delivery.ts`**

```typescript
import { db } from '@/lib/db'
import { sendEmailWithAttachment } from '@/lib/notifications/resend'
import { generateClientReportPdf } from '@/lib/services/report-generator'

export async function sendReportsForTenant(tenantId: string): Promise<{ sent: number; skipped: number }> {
  let sent = 0
  let skipped = 0

  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  if (!tenant) return { sent, skipped }

  const clients = await db.client.findMany({
    where: { tenantId, receivesReport: true },
    select: { id: true, name: true, email: true },
  })

  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  for (const client of clients) {
    const assets = await db.asset.findMany({
      where: { clientId: client.id },
      include: { category: { select: { name: true } } },
    })

    if (assets.length === 0) {
      skipped++
      continue
    }

    const assetIds = assets.map((a) => a.id)
    const workOrderItems = await db.workOrderItem.findMany({
      where: {
        assetId: { in: assetIds },
        workOrder: { createdAt: { gte: periodStart, lte: periodEnd } },
      },
      include: {
        workOrder: {
          select: {
            type: true, status: true, description: true, completedAt: true,
            assignedTo: { select: { name: true } },
          },
        },
      },
    })

    const woMap = new Map<string, (typeof workOrderItems)[0]['workOrder']>()
    for (const item of workOrderItems) {
      woMap.set(item.workOrderId, item.workOrder)
    }

    const pdf = await generateClientReportPdf({
      tenantName: tenant.name,
      client: { name: client.name, email: client.email },
      periodStart,
      periodEnd,
      assets: assets.map((a) => ({
        name: a.name,
        category: a.category?.name ?? null,
        location: a.location,
        status: a.status,
      })),
      workOrders: Array.from(woMap.values()).map((wo) => ({
        type: wo.type,
        status: wo.status,
        description: wo.description,
        technicianName: wo.assignedTo?.name ?? null,
        completedAt: wo.completedAt,
      })),
    })

    const dateStr = periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    await sendEmailWithAttachment(
      client.email,
      `Maintenance Report — ${tenant.name} — ${dateStr}`,
      `Dear ${client.name},\n\nPlease find attached your maintenance report for the past 7 days.\n\nRegards,\n${tenant.name}`,
      { filename: `maintenance-report-${dateStr.replace(/[,\s]+/g, '-')}.pdf`, content: pdf }
    )

    sent++
  }

  return { sent, skipped }
}

export async function sendAllTenantReports(): Promise<void> {
  const tenants = await db.tenant.findMany({ select: { id: true } })
  for (const tenant of tenants) {
    await sendReportsForTenant(tenant.id)
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/services/report-delivery.test.ts
```

Expected: 5 tests, all PASS.

- [ ] **Step 6: Run full suite**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/notifications/resend.ts lib/services/report-delivery.ts tests/services/report-delivery.test.ts
git commit -m "feat: add report delivery service and sendEmailWithAttachment"
```

---

## Task 9: Report send API routes and cron

**Files:**
- Create: `app/api/reports/send/route.ts`
- Create: `app/api/cron/weekly-report/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `app/api/reports/send/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/tenant'
import { sendReportsForTenant } from '@/lib/services/report-delivery'

export async function POST() {
  try {
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const result = await sendReportsForTenant(user.tenantId)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/cron/weekly-report/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { sendAllTenantReports } from '@/lib/services/report-delivery'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await sendAllTenantReports()
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cron/weekly-report] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Update `vercel.json`**

The current `vercel.json` has one cron entry. Add the weekly-report entry:

```json
{
  "crons": [
    {
      "path": "/api/cron/pm-check",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/reports/send/route.ts app/api/cron/weekly-report/route.ts vercel.json
git commit -m "feat: add manual send and weekly cron routes for reports"
```

---

## Task 10: Client management UI and sidebar

**Files:**
- Create: `components/settings/ClientManager.tsx`
- Create: `app/(dashboard)/settings/clients/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `components/settings/ClientManager.tsx`**

```tsx
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
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivesReport: receives }),
      })
      if (res.ok) {
        const updated = await res.json()
        setClients((prev) => prev.map((c) => (c.id === id ? updated : c)))
      }
    } catch {
      // checkbox will revert on next render
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
                      className="h-4 w-4 cursor-pointer"
                    />
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
```

- [ ] **Step 2: Create `app/(dashboard)/settings/clients/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { listClients } from '@/lib/services/clients'
import { ClientManager } from '@/components/settings/ClientManager'

export default async function ClientsSettingsPage() {
  const user = await getSessionUser()
  if (user.role !== 'ADMIN') redirect('/settings')

  const clients = await listClients(user.tenantId)

  return <ClientManager clients={clients} />
}
```

- [ ] **Step 3: Update `components/layout/Sidebar.tsx`**

Add `Building2` import and a Clients nav item. Replace the file with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wrench, ClipboardList, Calendar, Users, Tag, Building2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/assets', label: 'Assets', icon: Wrench },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/schedules', label: 'Schedules', icon: Calendar },
  { href: '/settings/users', label: 'Team', icon: Users },
  { href: '/settings/categories', label: 'Categories', icon: Tag },
  { href: '/settings/clients', label: 'Clients', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-white px-3 py-4">
      <div className="mb-6 px-3">
        <span className="text-lg font-semibold tracking-tight">MaintainIQ</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(href) && href !== '/settings'
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --reporter=dot
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/settings/ClientManager.tsx "app/(dashboard)/settings/clients/page.tsx" components/layout/Sidebar.tsx
git commit -m "feat: add client management UI and sidebar link"
```
