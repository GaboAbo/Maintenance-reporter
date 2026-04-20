# Plan 5 — Asset Categories Design

**Date:** 2026-04-19  
**Scope:** Replace the free-text `category` field on assets with a structured dropdown backed by a relational `AssetCategory` table. System categories are pre-seeded; admins can add and delete tenant-specific custom categories from a new settings page.

---

## 1. Goals

- Asset category becomes a validated dropdown (not free text)
- App ships with predefined system categories: HVAC, Electrical, Plumbing, Equipment, Vehicle, Other
- ADMIN users can add custom categories for their tenant
- ADMIN users can delete custom categories — blocked if any assets are assigned to them
- System categories cannot be deleted by anyone (only by developers via DB)

---

## 2. Schema Changes

### New model: `AssetCategory`

```prisma
model AssetCategory {
  id       String  @id @default(cuid())
  tenantId String?         // null = system category
  name     String
  isSystem Boolean @default(false)

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assets  Asset[]

  @@unique([tenantId, name])
  @@index([tenantId])
}
```

- `tenantId = null` + `isSystem = true` → system category
- `tenantId = <id>` + `isSystem = false` → tenant custom category
- `@@unique([tenantId, name])` prevents duplicate names within a tenant (and within system categories)

### Modified model: `Asset`

Remove: `category String?`  
Add: `categoryId String?` with relation to `AssetCategory` using `onDelete: SetNull`

```prisma
categoryId  String?
category    AssetCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` is the DB-level fallback. The service layer checks for assigned assets before deletion and returns a user-friendly error.

### `Tenant` model

Add the reverse relation:

```prisma
assetCategories AssetCategory[]
```

### Seed

`prisma/seed.ts` upserts the 6 system categories with `tenantId = null, isSystem = true`:

```
HVAC, Electrical, Plumbing, Equipment, Vehicle, Other
```

Uses `upsert` on `{ tenantId_name: { tenantId: null, name } }` so re-running is safe.

---

## 3. Service Layer

**`lib/services/categories.ts`** (new file)

```typescript
listCategories(tenantId: string): Promise<AssetCategory[]>
```
Returns system categories (`tenantId = null`) + tenant's custom categories, ordered by `name` ascending.

```typescript
createCategory(tenantId: string, name: string): Promise<AssetCategory>
```
Creates a tenant category. Throws if `name` already exists for this tenant (unique constraint violation → surfaced as `409`).

```typescript
deleteCategory(tenantId: string, categoryId: string): Promise<void>
```
Checks:
1. Category exists and belongs to `tenantId` → `404` if not found
2. `isSystem = false` → `403` if system category
3. No assets assigned (`asset.count where categoryId`) → `409` with message `"Category is assigned to N asset(s)"` if in use
4. Deletes the category

---

## 4. API Routes

### `GET /api/categories`
Returns combined list of system + tenant categories. No auth restriction (all roles can read).

### `POST /api/categories`
Body: `{ name: string }`. ADMIN only. Calls `createCategory`. Returns `201` with the new category. Returns `409` on duplicate name.

### `DELETE /api/categories/[id]`
ADMIN only. Calls `deleteCategory`. Returns `204` on success. Returns `403` for system categories, `404` if not found, `409` if assets are using it.

---

## 5. Updated Service Functions

**`lib/services/assets.ts`**

- `listAssets`: include `category: { select: { id: true, name: true } }` in Prisma query
- `getAsset`: same inclusion
- `createAsset` / `updateAsset`: accept `categoryId: string | null` instead of `category: string | null`

---

## 6. UI Changes

### `AssetForm.tsx` (modify)

- Receives `categories: { id: string; name: string }[]` as a new prop
- Replaces the `category` `<Input>` with a `<select>` dropdown
- Submits `categoryId` (not `category` string)
- A blank option ("No category") maps to `categoryId: null`

### `app/(dashboard)/assets/new/page.tsx` and `app/(dashboard)/assets/[id]/edit/page.tsx` (modify)

Both server pages call `listCategories(tenantId)` and pass the result to `<AssetForm>`.

### `app/(dashboard)/assets/[id]/page.tsx` (modify)

Display `asset.category?.name ?? '—'` instead of `asset.category`.

### `components/assets/AssetTable.tsx` (modify)

Display `asset.category?.name ?? '—'` in the category column.

### `app/(dashboard)/settings/categories/page.tsx` (new)

ADMIN-only server page (non-admins are redirected to `/settings`). Fetches category list and renders `<CategoryManager users={categories} />`.

### `components/settings/CategoryManager.tsx` (new)

Client component (`'use client'`). Follows the `UserPrefsTable` pattern:

- Table of custom categories: name + delete button per row
- Delete button calls `DELETE /api/categories/[id]`; on `409` shows inline error ("In use by N asset(s)")
- On success removes the row from local state
- "Add category" input + button at the bottom; calls `POST /api/categories`; on success appends to local state
- System categories are not shown in this table (they're managed by devs only)

---

## 7. Error Handling

| Scenario | HTTP status | Message |
|---|---|---|
| Duplicate category name | 409 | `"A category with this name already exists"` |
| Delete system category | 403 | `"System categories cannot be deleted"` |
| Delete category not found / wrong tenant | 404 | `"Category not found"` |
| Delete category in use | 409 | `"Category is assigned to N asset(s)"` |

---

## 8. Testing

**`tests/services/categories.test.ts`** (new)

Mock `@/lib/db` following the existing Vitest pattern.

`listCategories`:
- Returns system categories (tenantId = null) + tenant's own categories
- Does not return other tenants' categories

`createCategory`:
- Creates and returns the new category
- Throws (or returns error) on duplicate name within tenant

`deleteCategory`:
- Deletes successfully when no assets use the category
- Returns 409-equivalent error when assets are assigned (N > 0)
- Returns 403-equivalent error when `isSystem = true`
- Returns 404-equivalent error when category belongs to a different tenant

**`tests/services/assets.test.ts`** (extend existing file):
- `createAsset` and `updateAsset` accept `categoryId` instead of `category` string
