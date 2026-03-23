'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { debounce } from 'lodash'
import type { Note } from '@/types/database'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [filtered, setFiltered] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  // Fetch notes from Supabase
  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) { toast.error('Failed to load notes'); return }
    setNotes(data || [])
    setFiltered(data || [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')
      await fetchNotes()
      setLoading(false)
    }
    init()
  }, [router])

  // Debounced search — waits 300ms after user stops typing
  const debouncedSearch = useCallback(
    debounce((query: string, allNotes: Note[]) => {
      if (!query.trim()) { setFiltered(allNotes); return }
      setFiltered(allNotes.filter(n =>
        n.title.toLowerCase().includes(query.toLowerCase())
      ))
    }, 300),
    []
  )

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    debouncedSearch(e.target.value, notes)
  }

  // Create a new blank note then navigate to editor
  const createNote = async () => {
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('notes')
      .insert({ title: 'Untitled Note', user_id: user!.id, content: null })
      .select()
      .single()
    if (error) { toast.error('Failed to create note'); setCreating(false); return }
    router.push(`/notes/${data.id}`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  // Format the updated_at timestamp nicely
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading your notes...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="font-bold text-xl text-gray-900">📝 Live Notes</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">{userEmail}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Notes</h2>
          <button onClick={createNote} disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {creating ? 'Creating...' : '+ New Note'}
          </button>
        </div>

        {/* Search bar */}
        <input type="text" placeholder="Search notes..." value={search}
          onChange={handleSearch}
          className="w-full border bg-white rounded-lg px-4 py-3 text-sm mb-6 outline-none focus:ring-2 focus:ring-blue-500" />

        {/* Empty state: no notes at all */}
        {notes.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-gray-500 font-medium">No notes yet</p>
            <p className="text-gray-400 text-sm mt-1">Click '+ New Note' to get started</p>
          </div>
        )}

        {/* Empty state: no search results */}
        {notes.length > 0 && filtered.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 font-medium">No notes match '{search}'</p>
            <button onClick={() => { setSearch(''); setFiltered(notes) }}
              className="text-blue-600 text-sm mt-2 hover:underline">
              Clear search
            </button>
          </div>
        )}

        {/* Notes list */}
        <div className="space-y-3">
          {filtered.map(note => (
            <div key={note.id}
              onClick={() => router.push(`/notes/${note.id}`)}
              className="bg-white border rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {note.title}
                </h3>
                <span className="text-xs text-gray-400 ml-4 shrink-0">
                  {formatDate(note.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
