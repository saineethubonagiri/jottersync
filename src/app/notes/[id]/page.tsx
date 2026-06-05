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

  // ── Share modal state ───────────────────────────────────────────────────────
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read')
  const [sharing, setSharing] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)

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
      setShareToken(data.share_token)  // load existing share token if any
      setLoading(false)
    }
    fetchNote()
  }, [noteId, router])

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>
    let reconnectAttempts = 0
    let currentChannel: ReturnType<typeof supabase.channel> | null = null

    const subscribe = () => {
      if (currentChannel) supabase.removeChannel(currentChannel)

      const channel = supabase
        .channel(`note:${noteId}:${Date.now()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${noteId}`
        }, (payload) => {
          if (payload.eventType === 'DELETE') {
            toast('Note was deleted', { icon: '🗑️' })
            router.push('/dashboard')
            return
          }
          if (payload.eventType === 'UPDATE') {
            const now = Date.now()
            if (now - lastSavedAt.current < 3000) return
            const updated = payload.new as Note
            setTitle(updated.title)
            setContent(updated.content)
            editorRef.current?.updateContent(updated.content as TipTapJSON)
            toast('Note updated from another device', { icon: '🔄' })
          }
        })
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
    }

    subscribe()

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

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const save = useCallback(
    debounce(async (newTitle: string, newContent: TipTapJSON | null) => {
      setStatus('saving')
      const { error } = await supabase
        .from('notes')
        .update({ title: newTitle, content: newContent, updated_at: new Date().toISOString() })
        .eq('id', noteId)
      if (error) { toast.error('Failed to save'); setStatus('error') }
      else { lastSavedAt.current = Date.now(); setStatus('saved') }
    }, 1000),
    [noteId]
  )

  // ── Offline/online handler ──────────────────────────────────────────────────
  useEffect(() => {
    const handleOffline = () => {
      toast('You are offline — changes will sync when reconnected', { icon: '📡', duration: 5000 })
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

  // ── Generate public share link ──────────────────────────────────────────────
  // Creates a random token, saves it to the notes table, and returns the URL.
  // If a token already exists, just returns the existing URL.
  const handleGenerateLink = async () => {
    if (shareToken) {
      // Token already exists — just copy it
      const url = `${window.location.origin}/shared/${shareToken}`
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
      return
    }

    setGeneratingLink(true)
    // Generate a random token — 32 hex characters
    const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const { error } = await supabase
      .from('notes')
      .update({ share_token: token })
      .eq('id', noteId)

    if (error) {
      toast.error('Failed to generate link')
      setGeneratingLink(false)
      return
    }

    setShareToken(token)
    const url = `${window.location.origin}/shared/${token}`
    await navigator.clipboard.writeText(url)
    toast.success('Link generated and copied!')
    setGeneratingLink(false)
  }

  // ── Share with specific user by email ──────────────────────────────────────
  // Looks up the user by email in the profiles table, then inserts a note_shares row.
  const handleShareWithUser = async () => {
    if (!shareEmail.trim()) { toast.error('Enter an email address'); return }

    setSharing(true)

    // Look up the user's ID from their email via auth.users
    // We use a Supabase RPC or profiles table lookup
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', shareEmail.trim())
      .single()

    // If not found by display_name, try matching by email via a different approach
    // Since profiles doesn't store email, we need to search auth users
    // For now we'll use an RPC function — but first let's try profiles
    if (profileError || !profileData) {
      toast.error('No user found with that email. They must have an account.')
      setSharing(false)
      return
    }

    const { error: shareError } = await supabase
      .from('note_shares')
      .insert({
        note_id: noteId,
        shared_with_user_id: profileData.id,
        permission_level: sharePermission
      })

    if (shareError) {
      if (shareError.code === '23505') {
        toast.error('Already shared with this user')
      } else {
        toast.error('Failed to share note')
      }
      setSharing(false)
      return
    }

    toast.success(`Note shared with ${shareEmail} (${sharePermission})`)
    setShareEmail('')
    setSharing(false)
  }

  // ── Other handlers ──────────────────────────────────────────────────────────
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value); setStatus('idle'); save(e.target.value, content)
  }
  const handleContentUpdate = (json: TipTapJSON) => {
    setContent(json); setStatus('idle'); save(title, json)
  }
  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('notes').delete().eq('id', noteId)
    if (error) { toast.error('Failed to delete note'); setDeleting(false); return }
    toast.success('Note deleted')
    router.push('/dashboard')
  }

  const connectionConfig = {
    connected:    { dot: 'bg-green-500', label: 'Live' },
    connecting:   { dot: 'bg-yellow-400', label: 'Connecting...' },
    disconnected: { dot: 'bg-red-500', label: 'Disconnected' },
  }[connectionStatus]

  const statusLabel = { idle: '', saving: '💾 Saving...', saved: '✓ Saved', error: '⚠ Save failed' }[status]
  const statusColor = { idle: 'text-transparent', saving: 'text-gray-400', saved: 'text-green-500', error: 'text-red-500' }[status]

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading note...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">

      {/* ── Top navbar ── */}
      <div className="border-b px-6 py-3 flex justify-between items-center sticky top-0 bg-white z-10">
        <button onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1">
          ← Back to notes
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connectionConfig.dot} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-gray-400">{connectionConfig.label}</span>
          </div>
          <span className={`text-xs transition-colors ${statusColor}`}>{statusLabel}</span>
          <button onClick={() => setShowShareModal(true)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Share
          </button>
          <button onClick={() => setShowDeleteModal(true)}
            className="text-sm text-red-500 hover:text-red-700 font-medium">
            Delete
          </button>
        </div>
      </div>

      {/* ── Editor area ── */}
      <div className="max-w-3xl mx-auto">
        <div className="px-6 pt-10 pb-4">
          <input type="text" value={title} onChange={handleTitleChange}
            placeholder="Untitled Note"
            className="w-full text-4xl font-bold text-gray-900 outline-none border-none placeholder-gray-300" />
        </div>
        {!loading && (
          <TipTapEditor ref={editorRef} initialContent={content} onUpdate={handleContentUpdate} />
        )}
      </div>

      {/* ── Share modal ── */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">Share this note</h3>
              <button onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* ── Public link section ── */}
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-2">Public link</p>
              <p className="text-xs text-gray-400 mb-3">
                Anyone with this link can view the note (read-only).
              </p>
              {shareToken && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono mb-3 break-all">
                  {`${window.location.origin}/shared/${shareToken}`}
                </div>
              )}
              <button onClick={handleGenerateLink} disabled={generatingLink}
                className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50">
                {generatingLink ? 'Generating...' : shareToken ? '📋 Copy link' : '🔗 Generate link'}
              </button>
            </div>

            <div className="border-t pt-5">
              <p className="text-sm font-medium text-gray-700 mb-2">Share with a user</p>
              <p className="text-xs text-gray-400 mb-3">
                They must already have an account. Enter their display name.
              </p>
              <input
                type="text"
                placeholder="Display name..."
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSharePermission('read')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    sharePermission === 'read'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  👁 Read only
                </button>
                <button
                  onClick={() => setSharePermission('edit')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    sharePermission === 'edit'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  ✏️ Can edit
                </button>
              </div>
              <button onClick={handleShareWithUser} disabled={sharing}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {sharing ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this note?</h3>
            <p className="text-sm text-gray-500 mb-6">This note will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}