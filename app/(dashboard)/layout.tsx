import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-14 border-b bg-white" />}>
          <Header />
        </Suspense>
        <main className="flex-1 overflow-y-auto bg-zinc-50 p-6">{children}</main>
      </div>
    </div>
  )
}
