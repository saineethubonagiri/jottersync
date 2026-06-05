// FILE: src/types/database.ts

export type TipTapJSON = {
  type: 'doc'
  content: TipTapNode[]
}

export type TipTapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: TipTapMark[]
  text?: string
}

export type TipTapMark = {
  type: string
  attrs?: Record<string, unknown>
}

export type Note = {
  id: string
  user_id: string
  title: string
  content: TipTapJSON | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  share_token: string | null  // ← NEW: unique token for public share links
}

export type Profile = {
  id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export type NoteShare = {
  id: string
  note_id: string
  shared_with_user_id: string
  permission_level: 'read' | 'edit'
  created_at: string
}

// Used in the "Shared with me" dashboard section —
// a note_shares row with the full note data joined in
export type NoteShareWithNote = {
  id: string
  note_id: string
  permission_level: 'read' | 'edit'
  created_at: string
  notes: Note
}