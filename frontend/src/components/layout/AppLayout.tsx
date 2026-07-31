import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setIsSidebarOpen(false)}
        onToggleCollapsed={() => setIsSidebarCollapsed((value) => !value)}
      />
      <div className="min-w-0 flex-1">
        <Header onOpenMenu={() => setIsSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
