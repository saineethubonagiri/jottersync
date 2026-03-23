'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { debounce } from 'lodash'
import type { Note } from '@/types/database'
import toast from 'react-hot-toast'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function NoteEditorPage() {
  const params = useParams()
  const noteId = params.id as string
  const router = useRouter()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load the note on mount
  useEffect(() => {
    const fetchNote = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single()
      if (error || !data) { toast.error('Note not found'); router.push('/dashboard'); return }
      setNote(data)
      setTitle(data.title)
      setContent(data.content?.text || '')
      setLoading(false)
    }
    fetchNote()
  }, [noteId, router])

  // Auto-save function — debounced 1 second
  const save = useCallback(
    debounce(async (newTitle: string, newContent: string) => {
      setStatus('saving')
      const { error } = await supabase
        .from('notes')
        .update({
          title: newTitle,
          content: { text: newContent },
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
      setStatus(error ? 'error' : 'saved')
      if (error) toast.error('Failed to save')
    }, 1000),
    [noteId]
  )

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    setStatus('idle')
    save(e.target.value, content)
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    setStatus('idle')
    save(title, e.target.value)
  }

  const handleDelete = async () => {
  setDeleting(true)
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
  if (error) { toast.error('Failed to delete note'); setDeleting(false); return }
  toast.success('Note deleted')
  router.push('/dashboard')
}

  const statusLabel = {
    idle: '',
    saving: '💾 Saving...',
    saved: '✓ Saved',
    error: '⚠ Save failed',
  }[status]

  const statusColor = {
    idle: 'text-transparent',
    saving: 'text-gray-400',
    saved: 'text-green-500',
    error: 'text-red-500',
  }[status]

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading note...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Toolbar */}
      <div className="border-b px-6 py-3 flex justify-between items-center sticky top-0 bg-white z-10">
        <button onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Back to notes
        </button>
        <div className="flex items-center gap-4">
          <span className={`text-xs transition-colors ${statusColor}`}>{statusLabel}</span>
          <button onClick={() => setShowDeleteModal(true)}
            className="text-sm text-red-500 hover:text-red-700 font-medium">
            Delete
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Note"
          className="w-full text-4xl font-bold text-gray-900 outline-none border-none mb-6 placeholder-gray-300"
        />
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing..."
          className="w-full min-h-[60vh] text-gray-700 text-base outline-none border-none resize-none leading-relaxed placeholder-gray-300"
        />
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Move to trash?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This note will be moved to trash. You can recover it later.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}