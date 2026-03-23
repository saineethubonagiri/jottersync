// FILE: src/types/database.ts
// These mirror the Supabase table columns exactly

export type Note = {
  id: string
  user_id: string
  title: string
  content: Record<string, unknown> | null  // JSONB — will be TipTap JSON later
  created_at: string
  updated_at: string
  deleted_at: string | null
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
