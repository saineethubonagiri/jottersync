// FILE: src/types/database.ts

// TipTap saves content as a JSON document tree.
// This is the shape of every note's `content` column in Supabase.
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
  content: TipTapJSON | null   // was Record<string, unknown> | null
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