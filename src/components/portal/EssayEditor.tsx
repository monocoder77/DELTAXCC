'use client';

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import type { Essay, Prompt, EssayComment } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { useEssayActions } from '@/lib/hooks';

interface EssayEditorProps {
  essay?: Essay;
  prompt: Prompt;
  comments: EssayComment[];
}

export default function EssayEditor({ essay, prompt, comments }: EssayEditorProps) {
  const { user, profile } = useAuth();
  const { updateEssay, addComment } = useEssayActions();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(essay?.updated_at || '');
  const [newComment, setNewComment] = useState('');
  const [localComments, setLocalComments] = useState(comments);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your essay...' }),
      CharacterCount,
    ],
    content: essay?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  });

  const wordCount = editor
    ? editor.storage.characterCount.words()
    : essay?.word_count || 0;

  const isOverLimit = wordCount > prompt.word_limit;

  const handleSave = async () => {
    setSaving(true);
    // Simulated save
    await new Promise(resolve => setTimeout(resolve, 800));
    setLastSaved(new Date().toISOString());
    setSaving(false);
  };

  const handleSubmitForReview = async () => {
    await handleSave();
    // In production: update essay status to 'in_review'
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user || !profile) return;
    const comment: EssayComment = {
      id: `comment-new-${Date.now()}`,
      essay_id: essay?.id || '',
      author_id: user.id,
      content: newComment,
      created_at: new Date().toISOString(),
      author: profile,
    };
    setLocalComments([...localComments, comment]);
    setNewComment('');
    if (essay) {
      await addComment(essay.id, user.id, newComment);
    }
  };

  return (
    <div>
      {/* Editor */}
      <div className="border-b border-portal-border">
        <div className="bg-portal-elevated rounded-none">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-portal-border bg-portal-card">
        <div className="flex items-center gap-4">
          <span className={`text-xs font-[family-name:var(--font-space-mono)] ${isOverLimit ? 'text-portal-red' : 'text-portal-dim'}`}>
            {wordCount} / {prompt.word_limit} words
          </span>
          {lastSaved && (
            <span className="text-xs text-portal-dim">
              Saved {new Date(lastSaved).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-portal-elevated border border-portal-border text-portal-text hover:bg-portal-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleSubmitForReview}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-portal-accent text-white hover:bg-portal-accent/90 transition-colors"
          >
            Submit for Review
          </button>
        </div>
      </div>

      {/* Comments Thread */}
      <div className="px-5 py-4">
        <h4 className="text-xs font-semibold text-portal-muted uppercase tracking-wide mb-3">
          Consultant Feedback ({localComments.length})
        </h4>

        {localComments.length === 0 ? (
          <p className="text-xs text-portal-dim">No comments yet. Your consultant will leave feedback here.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {localComments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                  comment.author?.role === 'consultant'
                    ? 'bg-portal-accent/20 text-portal-accent'
                    : 'bg-portal-green/20 text-portal-green'
                }`}>
                  {comment.author?.avatar_initials || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-portal-text">{comment.author?.full_name}</span>
                    <span className="text-[10px] text-portal-dim font-[family-name:var(--font-space-mono)]">
                      {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-portal-muted leading-relaxed">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            placeholder="Reply to your consultant..."
            className="flex-1 bg-portal-bg border border-portal-border rounded-lg px-3 py-2 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent/50 transition-colors"
          />
          <button
            onClick={handleAddComment}
            className="bg-portal-elevated border border-portal-border rounded-lg px-3 py-2 text-portal-muted hover:text-portal-accent transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
