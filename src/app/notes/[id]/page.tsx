'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { debounce } from 'lodash'
import type { Note, TipTapJSON } from '@/types/database'
import toast from 'react-hot-toast'
import TipTapEditor from '@/app/components/TipTapEditor'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export default function NoteEditorPage() {
  const params = useParams()
  const noteId = params.id as string
  const router = useRouter()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<TipTapJSON | null>(null)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')

  const editorRef = useRef<{ updateContent: (json: TipTapJSON) => void }>(null)
  const lastSavedAt = useRef<number>(0)

  // ── Load note on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchNote = async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single()

      if (error || !data) {
        toast.error('Note not found')
        router.push('/dashboard')
        return
      }

      setNote(data)
      setTitle(data.title)
      setContent(data.content)
      setLoading(false)
    }
    fetchNote()
  }, [noteId, router])

  useEffect(() => {
  let reconnectTimeout: ReturnType<typeof setTimeout>
  let reconnectAttempts = 0
  let currentChannel: ReturnType<typeof supabase.channel> | null = null

  const subscribe = () => {
    // Remove old channel if it exists
    if (currentChannel) {
      supabase.removeChannel(currentChannel)
    }

    const channel = supabase
      .channel(`note:${noteId}:${Date.now()}`)
      // ↑ Use timestamp instead of attempt count — guarantees a truly unique
      // channel name every time, which forces Supabase to create a fresh socket
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${noteId}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            toast('Note was deleted', { icon: '🗑️' })
            router.push('/dashboard')
            return
          }

          if (payload.eventType === 'UPDATE') {
            const now = Date.now()
            const timeSinceLastSave = now - lastSavedAt.current
            if (timeSinceLastSave < 3000) return

            const updated = payload.new as Note
            setTitle(updated.title)
            setContent(updated.content)
            editorRef.current?.updateContent(updated.content as TipTapJSON)
            toast('Note updated from another device', { icon: '🔄' })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          reconnectAttempts = 0
          clearTimeout(reconnectTimeout)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected')

          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
          reconnectAttempts++

          reconnectTimeout = setTimeout(() => {
            setConnectionStatus('connecting')
            subscribe()
          }, delay)
        } else {
          setConnectionStatus('connecting')
        }
      })

    currentChannel = channel
    return channel
  }

  subscribe()

  // ── Also reconnect when browser comes back online ──────────────────────────
  // This is the key fix: DevTools "offline" simulation doesn't always trigger
  // CLOSED status on the Supabase socket. The window 'online' event fires
  // reliably though, so we force a fresh channel subscription here.
  const handleOnline = () => {
    clearTimeout(reconnectTimeout)
    reconnectAttempts = 0
    setConnectionStatus('connecting')
    subscribe()
  }

  window.addEventListener('online', handleOnline)

  return () => {
    clearTimeout(reconnectTimeout)
    window.removeEventListener('online', handleOnline)
    if (currentChannel) supabase.removeChannel(currentChannel)
  }
}, [noteId, router])

  // ── Auto-save — debounced 1 second ─────────────────────────────────────────
  // MUST be defined before the offline useEffect below
  const save = useCallback(
    debounce(async (newTitle: string, newContent: TipTapJSON | null) => {
      setStatus('saving')

      const { error } = await supabase
        .from('notes')
        .update({
          title: newTitle,
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)

      if (error) {
        toast.error('Failed to save')
        setStatus('error')
      } else {
        lastSavedAt.current = Date.now()
        setStatus('saved')
      }
    }, 1000),
    [noteId]
  )

  // ── Offline / Online edge case handler ─────────────────────────────────────
  // save is defined above so it's safe to reference here
  useEffect(() => {
    const handleOffline = () => {
      toast('You are offline — changes will sync when reconnected', {
        icon: '📡',
        duration: 5000,
      })
      setConnectionStatus('disconnected')
    }

    const handleOnline = () => {
      toast.success('Back online — syncing changes')
      setConnectionStatus('connecting')
      save(title, content)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [title, content, save])

  // ── Title change handler ────────────────────────────────────────────────────
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    setStatus('idle')
    save(newTitle, content)
  }

  // ── TipTap content change handler ──────────────────────────────────────────
  const handleContentUpdate = (json: TipTapJSON) => {
    setContent(json)
    setStatus('idle')
    save(title, json)
  }

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)

    if (error) {
      toast.error('Failed to delete note')
      setDeleting(false)
      return
    }
    toast.success('Note deleted')
    router.push('/dashboard')
  }

  // ── Connection status indicator config ─────────────────────────────────────
  const connectionConfig = {
    connected:    { dot: 'bg-green-500', label: 'Live' },
    connecting:   { dot: 'bg-yellow-400', label: 'Connecting...' },
    disconnected: { dot: 'bg-red-500',   label: 'Disconnected' },
  }[connectionStatus]

  // ── Save status label & color ───────────────────────────────────────────────
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

      {/* ── Top navbar ── */}
      <div className="border-b px-6 py-3 flex justify-between items-center sticky top-0 bg-white z-10">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1"
        >
          ← Back to notes
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connectionConfig.dot} ${
              connectionStatus === 'connecting' ? 'animate-pulse' : ''
            }`} />
            <span className="text-xs text-gray-400">
              {connectionConfig.label}
            </span>
          </div>
          <span className={`text-xs transition-colors ${statusColor}`}>
            {statusLabel}
          </span>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ── Editor area ── */}
      <div className="max-w-3xl mx-auto">
        <div className="px-6 pt-10 pb-4">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            className="w-full text-4xl font-bold text-gray-900 outline-none border-none placeholder-gray-300"
          />
        </div>

        {!loading && (
          <TipTapEditor
            ref={editorRef}
            initialContent={content}
            onUpdate={handleContentUpdate}
          />
        )}
      </div>

      {/* ── Delete confirmation modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this note?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This note will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}