# Asset Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text `category` field on assets with a structured dropdown backed by a relational `AssetCategory` table, with predefined system categories and admin-managed custom categories.

**Architecture:** A new `AssetCategory` model stores both system categories (`tenantId = null`) and tenant custom categories. The `Asset.category` string field is replaced by a `categoryId` FK. A new `lib/services/categories.ts` service handles CRUD with in-use deletion blocking. Two new API routes expose category management. The `AssetForm` gains a `categories` prop and renders a `<Select>` dropdown. A new `/settings/categories` page lets ADMIN users manage custom categories via `CategoryManager`.

**Tech Stack:** Next.js 16 App Router, Prisma ORM, TypeScript, Zod, Vitest, Tailwind CSS, shadcn/ui Select component.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `AssetCategory` model, update `Asset` and `Tenant` |
| `prisma/seed.ts` | Create | Seed 6 system categories |
| `package.json` | Modify | Add `prisma.seed` config |
| `lib/services/categories.ts` | Create | `listCategories`, `createCategory`, `deleteCategory` |
| `tests/services/categories.test.ts` | Create | Unit tests for categories service |
| `app/api/categories/route.ts` | Create | GET + POST categories |
| `app/api/categories/[id]/route.ts` | Create | DELETE category |
| `lib/services/assets.ts` | Modify | Use `categoryId` instead of `category` string; include relation |
| `tests/services/assets.test.ts` | Modify | Update tests for `categoryId` |
| `app/api/assets/route.ts` | Modify | Zod schema uses `categoryId` |
| `app/api/assets/[id]/route.ts` | Modify | Zod schema uses `categoryId` |
| `components/assets/AssetForm.tsx` | Modify | Add `categories` prop; replace Input with Select |
| `app/(dashboard)/assets/new/page.tsx` | Modify | Async; fetch categories; pass to `AssetForm` |
| `app/(dashboard)/assets/[id]/edit/page.tsx` | Modify | Fetch categories; pass to `AssetForm` |
| `components/assets/AssetTable.tsx` | Modify | Display `category?.name` |
| `app/(dashboard)/assets/[id]/page.tsx` | Modify | Display `category?.name` |
| `app/(dashboard)/settings/categories/page.tsx` | Create | ADMIN-only server page |
| `components/settings/CategoryManager.tsx` | Create | Client component for category CRUD |

---

## Task 1: Schema migration and seed

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Update `prisma/schema.prisma`**

Make three changes:

**1. Add reverse relation to `Tenant` model** (after the `subscription` line):
```prisma
assetCategories AssetCategory[]
```

**2. Replace `category String?` in `Asset` model** with:
```prisma
categoryId String?
category   AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

**3. Add new model** (after the `Asset` model):
```prisma
model AssetCategory {
  id       String  @id @default(cuid())
  tenantId String?
  name     String
  isSystem Boolean @default(false)

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assets  Asset[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_asset_categories
```

Expected: migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Install `tsx` and add seed config to `package.json`**

```bash
npm install -D tsx
```

Then add a top-level `"prisma"` config key to `package.json` (not inside `dependencies` — this is a sibling of `"scripts"`):

```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
},
```

- [ ] **Step 4: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const SYSTEM_CATEGORIES = ['HVAC', 'Electrical', 'Plumbing', 'Equipment', 'Vehicle', 'Other']

async function main() {
  for (const name of SYSTEM_CATEGORIES) {
    const existing = await db.assetCategory.findFirst({ where: { isSystem: true, name } })
    if (!existing) {
      await db.assetCategory.create({ data: { name, isSystem: true } })
    }
  }
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system asset categories`)
}

main().catch(console.error).finally(() => db.$disconnect())
```

- [ ] **Step 5: Run the seed**

```bash
npx prisma db seed
```

Expected: `Seeded 6 system asset categories`

- [ ] **Step 6: Verify tests still pass**

```bash
npm test
```

Expected: 91 tests pass (schema change does not break existing mocked unit tests).

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts package.json package-lock.json
git commit -m "feat: add AssetCategory schema, migration, and system category seed"
```

---

## Task 2: Categories service and tests

**Files:**
- Create: `lib/services/categories.ts`
- Create: `tests/services/categories.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/categories.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    assetCategory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    asset: {
      count: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { listCategories, createCategory, deleteCategory } from '@/lib/services/categories'

const TENANT = 't1'

beforeEach(() => vi.clearAllMocks())

describe('listCategories', () => {
  it('queries system and tenant categories', async () => {
    vi.mocked(db.assetCategory.findMany).mockResolvedValue([])
    await listCategories(TENANT)
    expect(db.assetCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ tenantId: null }, { tenantId: TENANT }] },
      })
    )
  })

  it('returns system and tenant categories together', async () => {
    const cats = [
      { id: 's1', name: 'HVAC', isSystem: true, tenantId: null },
      { id: 'c1', name: 'Custom', isSystem: false, tenantId: TENANT },
    ]
    vi.mocked(db.assetCategory.findMany).mockResolvedValue(cats as any)
    const result = await listCategories(TENANT)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('HVAC')
    expect(result[1].name).toBe('Custom')
  })
})

describe('createCategory', () => {
  it('creates and returns new category', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue(null)
    const cat = { id: 'c2', name: 'My Cat', isSystem: false, tenantId: TENANT }
    vi.mocked(db.assetCategory.create).mockResolvedValue(cat as any)
    const result = await createCategory(TENANT, 'My Cat')
    expect(result.name).toBe('My Cat')
    expect(db.assetCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenantId: TENANT, name: 'My Cat', isSystem: false },
      })
    )
  })

  it('throws DUPLICATE error when name already exists for tenant', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1' } as any)
    await expect(createCategory(TENANT, 'HVAC')).rejects.toMatchObject({ code: 'DUPLICATE' })
    expect(db.assetCategory.create).not.toHaveBeenCalled()
  })
})

describe('deleteCategory', () => {
  it('deletes category when no assets use it', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(0)
    vi.mocked(db.assetCategory.delete).mockResolvedValue({} as any)
    await deleteCategory(TENANT, 'c1')
    expect(db.assetCategory.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })

  it('throws NOT_FOUND when category does not exist', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue(null)
    await expect(deleteCategory(TENANT, 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws NOT_FOUND when category belongs to different tenant', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: 'other' } as any)
    await expect(deleteCategory(TENANT, 'c1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('throws FORBIDDEN when attempting to delete a system category', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 's1', isSystem: true, tenantId: null } as any)
    await expect(deleteCategory(TENANT, 's1')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(db.asset.count).not.toHaveBeenCalled()
  })

  it('throws IN_USE with count when assets are assigned', async () => {
    vi.mocked(db.assetCategory.findFirst).mockResolvedValue({ id: 'c1', isSystem: false, tenantId: TENANT } as any)
    vi.mocked(db.asset.count).mockResolvedValue(3)
    const err = await deleteCategory(TENANT, 'c1').catch((e) => e)
    expect(err).toMatchObject({ code: 'IN_USE' })
    expect(err.message).toContain('3')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/services/categories.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/services/categories.ts`**

```typescript
import { db } from '@/lib/db'

export type CategoryEntry = {
  id: string
  name: string
  isSystem: boolean
  tenantId: string | null
}

export async function listCategories(tenantId: string): Promise<CategoryEntry[]> {
  return db.assetCategory.findMany({
    where: { OR: [{ tenantId: null }, { tenantId }] },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isSystem: true, tenantId: true },
  })
}

export async function createCategory(tenantId: string, name: string): Promise<CategoryEntry> {
  const existing = await db.assetCategory.findFirst({ where: { tenantId, name } })
  if (existing) throw Object.assign(new Error('A category with this name already exists'), { code: 'DUPLICATE' })
  return db.assetCategory.create({
    data: { tenantId, name, isSystem: false },
    select: { id: true, name: true, isSystem: true, tenantId: true },
  })
}

export async function deleteCategory(tenantId: string, categoryId: string): Promise<void> {
  const category = await db.assetCategory.findFirst({
    where: { id: categoryId },
    select: { id: true, isSystem: true, tenantId: true },
  })

  if (!category) throw Object.assign(new Error('Category not found'), { code: 'NOT_FOUND' })
  if (category.isSystem) throw Object.assign(new Error('System categories cannot be deleted'), { code: 'FORBIDDEN' })
  if (category.tenantId !== tenantId) throw Object.assign(new Error('Category not found'), { code: 'NOT_FOUND' })

  const assetCount = await db.asset.count({ where: { categoryId } })
  if (assetCount > 0) {
    throw Object.assign(
      new Error(`Category is assigned to ${assetCount} asset(s)`),
      { code: 'IN_USE', count: assetCount }
    )
  }

  await db.assetCategory.delete({ where: { id: categoryId } })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/services/categories.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/services/categories.ts tests/services/categories.test.ts
git commit -m "feat: add categories service with list, create, and delete"
```

---

## Task 3: Categories API routes

**Files:**
- Create: `app/api/categories/route.ts`
- Create: `app/api/categories/[id]/route.ts`

- [ ] **Step 1: Create `app/api/categories/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/lib/tenant'
import { listCategories, createCategory } from '@/lib/services/categories'

const CreateCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
})

export async function GET() {
  try {
    const user = await getSessionUser()
    const categories = await listCategories(user.tenantId)
    return NextResponse.json(categories)
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

    const parsed = CreateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const category = await createCategory(user.tenantId, parsed.data.name)
    return NextResponse.json(category, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'DUPLICATE') return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/categories/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/tenant'
import { deleteCategory } from '@/lib/services/categories'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getSessionUser()
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await deleteCategory(user.tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'FORBIDDEN') return NextResponse.json({ error: 'System categories cannot be deleted' }, { status: 403 })
    if (err.code === 'NOT_FOUND') return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    if (err.code === 'IN_USE') return NextResponse.json({ error: err.message }, { status: 409 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All existing tests pass (routes are not unit tested — service tests cover the logic).

- [ ] **Step 4: Commit**

```bash
git add app/api/categories/route.ts app/api/categories/\[id\]/route.ts
git commit -m "feat: add categories API routes (GET, POST, DELETE)"
```

---

## Task 4: Update assets service and API routes

**Files:**
- Modify: `lib/services/assets.ts`
- Modify: `tests/services/assets.test.ts`
- Modify: `app/api/assets/route.ts`
- Modify: `app/api/assets/[id]/route.ts`

- [ ] **Step 1: Update `lib/services/assets.ts`**

Replace the entire file:

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
    },
  })
}

export async function getAsset(tenantId: string, id: string) {
  return db.asset.findFirst({
    where: { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
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

- [ ] **Step 2: Update `tests/services/assets.test.ts`**

Replace the `createAsset` test to use `categoryId`:

```typescript
describe('createAsset', () => {
  it('creates asset with tenantId', async () => {
    vi.mocked(db.asset.create).mockResolvedValue({ id: 'a2', tenantId: TENANT, name: 'Pump B' } as any)
    const result = await createAsset(TENANT, { name: 'Pump B', status: 'ACTIVE' })
    expect(db.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT, name: 'Pump B' }) })
    )
    expect(result.name).toBe('Pump B')
  })

  it('passes categoryId when provided', async () => {
    vi.mocked(db.asset.create).mockResolvedValue({ id: 'a3', tenantId: TENANT, name: 'Pump C', categoryId: 'cat1' } as any)
    await createAsset(TENANT, { name: 'Pump C', categoryId: 'cat1' })
    expect(db.asset.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ categoryId: 'cat1' }) })
    )
  })
})
```

- [ ] **Step 3: Update `app/api/assets/route.ts`**

Replace `category: z.string().optional()` with `categoryId: z.string().optional().nullable()` in `AssetSchema`, and update the `createAsset` call to pass `categoryId`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import { listAssets, createAsset } from '@/lib/services/assets'

const AssetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  serialNumber: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  location: z.string().optional(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED']).optional(),
  installationDate: z.string().datetime().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
})

export async function GET() {
  try {
    const tenantId = await getTenantId()
    const assets = await listAssets(tenantId)
    return NextResponse.json(assets)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = AssetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { installationDate, warrantyExpiry, ...rest } = parsed.data
    const asset = await createAsset(tenantId, {
      ...rest,
      installationDate: installationDate ? new Date(installationDate) : null,
      warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Update `app/api/assets/[id]/route.ts`**

Replace `category: z.string().optional().nullable()` with `categoryId: z.string().optional().nullable()` in `UpdateAssetSchema`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTenantId } from '@/lib/tenant'
import { getAsset, updateAsset, decommissionAsset } from '@/lib/services/assets'

const UpdateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED']).optional(),
  installationDate: z.string().datetime().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    const asset = await getAsset(tenantId, id)
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(asset)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const parsed = UpdateAssetSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { installationDate, warrantyExpiry, ...rest } = parsed.data
    const asset = await updateAsset(tenantId, id, {
      ...rest,
      ...(installationDate !== undefined && { installationDate: installationDate ? new Date(installationDate) : null }),
      ...(warrantyExpiry !== undefined && { warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null }),
    })

    return NextResponse.json(asset)
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const tenantId = await getTenantId()
    await decommissionAsset(tenantId, id)
    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass (existing assets tests updated, new category test added).

- [ ] **Step 6: Commit**

```bash
git add lib/services/assets.ts tests/services/assets.test.ts app/api/assets/route.ts app/api/assets/\[id\]/route.ts
git commit -m "feat: update assets service and API to use categoryId FK"
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

type Category = { id: string; name: string }

type AssetFormAsset = {
  id: string
  name: string
  serialNumber?: string | null
  model?: string | null
  manufacturer?: string | null
  location?: string | null
  categoryId?: string | null
  status: AssetStatus
}

type AssetFormProps = {
  asset?: AssetFormAsset
  categories: Category[]
}

export function AssetForm({ asset, categories }: AssetFormProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<AssetStatus>(asset?.status ?? 'ACTIVE')
  const [categoryId, setCategoryId] = useState<string>(asset?.categoryId ?? '')

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
      categoryId: categoryId || null,
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
              <SelectItem value="">No category</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={asset?.location ?? ''} />
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

export default async function NewAssetPage() {
  const tenantId = await getTenantId()
  const categories = await listCategories(tenantId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">New asset</h1>
        <p className="text-sm text-zinc-500">Add a piece of equipment to your asset registry.</p>
      </div>
      <AssetForm categories={categories} />
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

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenantId = await getTenantId()
  const [asset, categories] = await Promise.all([
    getAsset(tenantId, id),
    listCategories(tenantId),
  ])

  if (!asset) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit asset</h1>
        <p className="text-sm text-zinc-500">{asset.name}</p>
      </div>
      <AssetForm asset={asset} categories={categories} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/assets/AssetForm.tsx app/\(dashboard\)/assets/new/page.tsx app/\(dashboard\)/assets/\[id\]/edit/page.tsx
git commit -m "feat: replace category text input with structured dropdown in AssetForm"
```

---

## Task 6: Update AssetTable and asset detail display

**Files:**
- Modify: `components/assets/AssetTable.tsx`
- Modify: `app/(dashboard)/assets/[id]/page.tsx`

- [ ] **Step 1: Replace `components/assets/AssetTable.tsx`**

```tsx
import Link from 'next/link'
import { AssetStatusBadge } from './AssetStatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Asset, AssetStatus } from '@prisma/client'

type AssetWithCountAndCategory = Omit<Asset, 'category'> & {
  _count: { workOrderItems: number }
  category: { id: string; name: string } | null
}

export function AssetTable({ assets }: { assets: AssetWithCountAndCategory[] }) {
  if (assets.length === 0) {
    return <p className="text-sm text-zinc-500">No assets yet. Add your first asset to get started.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
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

Replace `{asset.category && <span ...>{asset.category}</span>}` with `{asset.category?.name && <span ...>{asset.category.name}</span>}`. The full page becomes:

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
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/assets/AssetTable.tsx app/\(dashboard\)/assets/\[id\]/page.tsx
git commit -m "feat: display category name in asset list and detail pages"
```

---

## Task 7: Settings categories page and CategoryManager

**Files:**
- Create: `app/(dashboard)/settings/categories/page.tsx`
- Create: `components/settings/CategoryManager.tsx`

- [ ] **Step 1: Create `components/settings/CategoryManager.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Category = {
  id: string
  name: string
  isSystem: boolean
  tenantId: string | null
}

type Props = {
  categories: Category[]
}

export function CategoryManager({ categories: initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        setNewName('')
      } else {
        const data = await res.json().catch(() => ({}))
        setAddError(data.error ?? 'Failed to add category')
      }
    } catch {
      setAddError('Network error — please try again')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (res.status === 204) {
        setCategories((prev) => prev.filter((c) => c.id !== id))
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Asset categories</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage custom categories for your team's assets.</p>
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-zinc-400 text-center">
                  No custom categories yet.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">{cat.name}</td>
                  <td className="px-4 py-3 text-right">
                    {deleteErrors[cat.id] && (
                      <span className="mr-3 text-xs text-red-600">{deleteErrors[cat.id]}</span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingId === cat.id}
                      onClick={() => handleDelete(cat.id)}
                    >
                      {deletingId === cat.id ? 'Deleting…' : 'Delete'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 max-w-sm">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          disabled={adding}
        />
        <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
          {adding ? 'Adding…' : 'Add'}
        </Button>
      </div>
      {addError && <p className="text-sm text-red-600">{addError}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/settings/categories/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/tenant'
import { listCategories } from '@/lib/services/categories'
import { CategoryManager } from '@/components/settings/CategoryManager'

export default async function CategoriesSettingsPage() {
  const user = await getSessionUser()
  if (user.role !== 'ADMIN') redirect('/settings')

  const allCategories = await listCategories(user.tenantId)
  const customCategories = allCategories.filter((c) => !c.isSystem)

  return <CategoryManager categories={customCategories} />
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: All tests pass (99 total: 91 prior + 8 new categories tests).

- [ ] **Step 4: Commit**

```bash
git add components/settings/CategoryManager.tsx app/\(dashboard\)/settings/categories/page.tsx
git commit -m "feat: add settings page and CategoryManager for admin custom category management"
```
