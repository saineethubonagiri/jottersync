'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useImperativeHandle, forwardRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import type { TipTapJSON } from '@/types/database'

type Props = {
  initialContent: TipTapJSON | null
  onUpdate: (json: TipTapJSON) => void
  editable?: boolean
}

type EditorHandle = {
  updateContent: (json: TipTapJSON) => void
}

type ToolbarButtonProps = {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      onMouseDown={e => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={`
        px-2 py-1 rounded text-sm font-medium transition-colors
        ${active
          ? 'bg-gray-900 text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }
      `}
    >
      {children}
    </button>
  )
}

const TipTapEditor = forwardRef<EditorHandle, Props>(
  ({ initialContent, onUpdate, editable = true }, ref) => {

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: 'Start writing…',
        }),
        Typography,
      ],

      content: initialContent ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },

      editable,

      onUpdate({ editor }) {
        onUpdate(editor.getJSON() as TipTapJSON)
      },

      immediatelyRender: false,
    })

    useImperativeHandle(ref, () => ({
      updateContent: (json: TipTapJSON) => {
        if (editor && json) {
          editor.commands.setContent(json, false as unknown as boolean)
        }
      }
    }), [editor])

    if (!editor) return null

    return (
      <div className="tiptap-wrapper">

        <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b border-gray-100 sticky top-[57px] bg-white z-10">

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Bold (Cmd+B)"
          >
            <strong>B</strong>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Italic (Cmd+I)"
          >
            <em>I</em>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Strikethrough"
          >
            <s>S</s>
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            title="Inline Code"
          >
            {'<>'}
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            H1
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            H2
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            H3
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Bullet List"
          >
            • List
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Numbered List"
          >
            1. List
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Blockquote"
          >
            ❝
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code Block"
          >
            {'{ }'}
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo (Cmd+Z)"
          >
            ↩
          </ToolbarButton>

          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo (Cmd+Shift+Z)"
          >
            ↪
          </ToolbarButton>
        </div>

        <EditorContent
          editor={editor}
          className="px-6 py-6 min-h-[60vh] prose prose-gray max-w-none focus:outline-none"
        />

        <style jsx global>{`
          .tiptap-wrapper .ProseMirror {
            outline: none;
          }
          .tiptap-wrapper .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #9ca3af;
            pointer-events: none;
            height: 0;
          }
          .tiptap-wrapper .ProseMirror h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0 0.5rem; }
          .tiptap-wrapper .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; }
          .tiptap-wrapper .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 1rem 0 0.5rem; }
          .tiptap-wrapper .ProseMirror ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
          .tiptap-wrapper .ProseMirror ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
          .tiptap-wrapper .ProseMirror blockquote { border-left: 3px solid #e5e7eb; padding-left: 1rem; color: #6b7280; margin: 0.5rem 0; }
          .tiptap-wrapper .ProseMirror code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.25rem; font-size: 0.875rem; }
          .tiptap-wrapper .ProseMirror pre { background: #1f2937; color: #f9fafb; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.5rem 0; }
          .tiptap-wrapper .ProseMirror pre code { background: none; padding: 0; }
        `}</style>
      </div>
    )
  }
)

TipTapEditor.displayName = 'TipTapEditor'

export default TipTapEditor