'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUserEmail(user.email || '')
      }
    }
    getUser()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="font-bold text-xl text-gray-900">JotterSync</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{userEmail}</span>
          <button onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800 font-medium">
            Sign Out
          </button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-xl border p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You're logged in!</h2>
          <p className="text-gray-500">Notes will appear here. Phase 1 complete </p>
        </div>
      </main>
    </div>
  )
}
