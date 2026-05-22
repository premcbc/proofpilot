'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export interface UserProfile {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

interface Props {
  children: React.ReactNode
  profile: UserProfile | null
}

export function DashboardLayout({ children, profile }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} profile={profile} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} profile={profile} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
