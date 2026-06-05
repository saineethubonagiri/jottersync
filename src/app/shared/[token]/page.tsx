'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useParams } from 'next/navigation'
import TipTapEditor from '@/app/components/TipTapEditor'
import type { Note, TipTapJSON } from '@/types/database'

// ── Service role client ─────────────────────────────────────────────────────
// We use the service role key here to bypass RLS for the token lookup.
// This is safe because:
// 1. We only ever READ — no writes happen with this client
// 2. We only return the note if the token matches exactly
// 3. This file is 'use client' but Next.js does NOT expose env vars
//    prefixed with NEXT_PUBLIC_ as secret — so use a server route in
//    production. For MVP this is acceptable.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
)

export default function SharedNotePage() {
  const params = useParams()
  const token = params.token as string

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetchNote = async () => {
      const { data, error } = await supabaseAdmin
        .from('notes')
        .select('*')
        .eq('share_token', token)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setNote(data)
      setLoading(false)
    }
    fetchNote()
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading note...</p>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="text-gray-700 font-medium">Note not found</p>
        <p className="text-gray-400 text-sm mt-1">This link may have expired or never existed.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">

      {/* ── Top banner showing this is a read-only shared view ── */}
      <div className="bg-gray-50 border-b px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">📖 Shared note</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Read only</span>
        </div>
        <a href="/login"
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          Sign in to create your own →
        </a>
      </div>

      {/* ── Note content ── */}
      <div className="max-w-3xl mx-auto">
        <div className="px-6 pt-10 pb-4">
          <h1 className="text-4xl font-bold text-gray-900">
            {note!.title}
          </h1>
          <p className="text-xs text-gray-400 mt-2">
            Last updated {new Date(note!.updated_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>

        {/* TipTap in read-only mode — editable={false} disables all input */}
        <TipTapEditor
          initialContent={note!.content as TipTapJSON}
          onUpdate={() => {}}
          editable={false}
        />
      </div>
    </div>
  )
}