import { auth, signOut } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import type { SessionUser } from '@/types'

export async function Header() {
  const session = await auth()
  const user = session?.user as SessionUser | undefined

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div />
      {user && (
        <div className="flex items-center gap-4">
          {user.role && (
            <span className="text-sm text-zinc-500">
              {user.name} · <span className="capitalize">{user.role.toLowerCase()}</span>
            </span>
          )}
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      )}
    </header>
  )
}
