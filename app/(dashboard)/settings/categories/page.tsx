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
