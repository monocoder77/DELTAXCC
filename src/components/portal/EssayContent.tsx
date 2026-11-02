'use client';

/* ==========================================================================
   Read-only essay renderer.
   Essay HTML is written by students, so it is never injected with
   dangerouslySetInnerHTML. Tiptap parses it into its schema, which drops
   scripts, event handlers and any element StarterKit does not know.
   ========================================================================== */

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cx } from './ui/primitives';

export default function EssayContent({
  html,
  className,
  emptyText = 'Nothing written yet.',
}: {
  html: string | null | undefined;
  className?: string;
  emptyText?: string;
}) {
  const content = html ?? '';
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: 'tiptap !min-h-0' } },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!content.replace(/<[^>]*>/g, '').trim()) {
    return <p className={cx('font-serif italic text-portal-dim', className)}>{emptyText}</p>;
  }

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
