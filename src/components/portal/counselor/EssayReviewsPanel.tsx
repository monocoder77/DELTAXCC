'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, Essay, Prompt, School, EssayStatus, EssayComment } from '@/types/database';

type ReviewFilter = 'all' | 'in_review' | 'revision' | 'final';

const statusConfig: Record<EssayStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-portal-dim', bg: 'bg-portal-dim/10' },
  draft: { label: 'Draft', color: 'text-portal-amber', bg: 'bg-portal-amber/10' },
  in_review: { label: 'Awaiting Review', color: 'text-portal-accent', bg: 'bg-portal-accent/10' },
  revision: { label: 'Needs Revision', color: 'text-portal-amber', bg: 'bg-portal-amber/10' },
  final: { label: 'Approved', color: 'text-portal-green', bg: 'bg-portal-green/10' },
  submitted: { label: 'Submitted', color: 'text-portal-green', bg: 'bg-portal-green/10' },
};

export default function EssayReviewsPanel() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [expandedEssay, setExpandedEssay] = useState<string | null>(null);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [comments, setComments] = useState<EssayComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      const { data: studs } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      const studentList = (studs as Profile[]) || [];
      setStudents(studentList);
      const ids = studentList.map(s => s.id);
      if (ids.length === 0) { setLoading(false); return; }

      const [essayRes, schoolRes] = await Promise.all([
        supabase.from('essays').select('*').in('student_id', ids),
        supabase.from('schools').select('*').in('student_id', ids),
      ]);

      const essayData = (essayRes.data as Essay[]) || [];
      const schoolData = (schoolRes.data as School[]) || [];
      setEssays(essayData);
      setSchools(schoolData);

      const schoolIds = schoolData.map(s => s.id);
      if (schoolIds.length > 0) {
        const { data: promptData } = await supabase
          .from('prompts')
          .select('*')
          .in('school_id', schoolIds);
        setPrompts((promptData as Prompt[]) || []);
      }

      const essayIds = essayData.map(e => e.id);
      if (essayIds.length > 0) {
        const { data: commentData } = await supabase
          .from('essay_comments')
          .select('*, author:profiles(*)')
          .in('essay_id', essayIds);
        setComments((commentData as EssayComment[]) || []);
      }

      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const reviewable = essays.filter(e => ['in_review', 'revision', 'final', 'submitted'].includes(e.status));

  const filtered = reviewable.filter(e => {
    if (filter === 'in_review') return e.status === 'in_review';
    if (filter === 'revision') return e.status === 'revision';
    if (filter === 'final') return e.status === 'final' || e.status === 'submitted';
    return true;
  }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const changeStatus = async (essayId: string, newStatus: EssayStatus) => {
    setEssays(prev => prev.map(e => e.id === essayId ? { ...e, status: newStatus } : e));
    const supabase = getSupabase();
    await supabase.from('essays').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', essayId);
  };

  const addComment = async (essayId: string) => {
    if (!newComment.trim() || !profile) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('essay_comments')
      .insert({ essay_id: essayId, author_id: profile.id, content: newComment })
      .select('*, author:profiles(*)')
      .single();
    if (data) setComments(prev => [...prev, data as EssayComment]);
    setNewComment('');
  };

  const counts = {
    all: reviewable.length,
    in_review: reviewable.filter(e => e.status === 'in_review').length,
    revision: reviewable.filter(e => e.status === 'revision').length,
    final: reviewable.filter(e => e.status === 'final' || e.status === 'submitted').length,
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Essay Reviews</h1>
        <p className="text-portal-body text-sm mt-1.5">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Essay Reviews</h1>
        <p className="text-portal-body text-sm mt-1.5">Review and provide feedback on student essays</p>
      </div>

      <div className="flex gap-2 mb-6">
        {([['all', 'All'], ['in_review', 'Awaiting Review'], ['revision', 'In Revision'], ['final', 'Approved']] as [ReviewFilter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === f ? 'bg-portal-green text-white' : 'border border-portal-border-subtle text-portal-muted hover:text-portal-text'}`}>
            {label} <span className="ml-1 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-portal-muted">No essays match this filter.</p>
        )}
        {filtered.map(essay => {
          const prompt = prompts.find(p => p.id === essay.prompt_id);
          const school = prompt ? schools.find(s => s.id === prompt.school_id) : null;
          const student = students.find(s => s.id === essay.student_id);
          const isExpanded = expandedEssay === essay.id;
          const sc = statusConfig[essay.status];
          const essayComments = comments.filter(c => c.essay_id === essay.id);

          return (
            <div key={essay.id} className="bg-portal-surface border border-portal-border-subtle rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
              <button
                onClick={() => setExpandedEssay(isExpanded ? null : essay.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-portal-hover transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-portal-text">{student?.full_name}</span>
                    <span className="text-xs text-portal-dim">&middot;</span>
                    <span className="text-xs text-portal-muted truncate">{school?.name}</span>
                  </div>
                  <p className="text-xs text-portal-dim truncate">{prompt?.title}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${sc.bg} ${sc.color} flex-shrink-0`}>{sc.label}</span>
                <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] flex-shrink-0">{essay.word_count}w</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-portal-dim transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isExpanded && (
                <div className="border-t border-portal-border-subtle">
                  <div className="px-5 py-3 bg-portal-bg/50">
                    <blockquote className="text-sm text-portal-muted italic border-l-2 border-portal-accent/30 pl-4">{prompt?.prompt_text}</blockquote>
                  </div>

                  <div className="px-5 py-4">
                    <div className="text-sm text-portal-text leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: essay.content || '<span class="text-portal-dim">No content yet.</span>' }} />
                  </div>

                  <div className="px-5 py-3 bg-portal-bg/30 border-t border-portal-border-subtle flex items-center gap-2">
                    <span className="text-xs text-portal-muted mr-2">Change status:</span>
                    {essay.status === 'in_review' && (
                      <>
                        <button onClick={() => changeStatus(essay.id, 'revision')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-portal-amber/30 text-portal-amber hover:bg-portal-amber/10 transition-colors">
                          Needs Revision
                        </button>
                        <button onClick={() => changeStatus(essay.id, 'final')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-portal-green/30 text-portal-green hover:bg-portal-green/10 transition-colors">
                          Approve (Final)
                        </button>
                      </>
                    )}
                    {essay.status === 'revision' && (
                      <button onClick={() => changeStatus(essay.id, 'final')} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-portal-green/30 text-portal-green hover:bg-portal-green/10 transition-colors">
                        Approve (Final)
                      </button>
                    )}
                    {essay.status === 'final' && (
                      <span className="text-xs text-portal-green">Approved</span>
                    )}
                  </div>

                  <div className="px-5 py-4 border-t border-portal-border-subtle">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-3">Comments ({essayComments.length})</h4>
                    {essayComments.map(c => (
                      <div key={c.id} className="flex gap-3 mb-3">
                        <div className="w-7 h-7 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-[10px] font-semibold text-portal-accent flex-shrink-0">
                          {c.author?.avatar_initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-portal-text">{c.author?.full_name}</span>
                            <span className="text-[10px] text-portal-dim font-[family-name:var(--font-space-mono)]">{new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <p className="text-sm text-portal-muted">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment(essay.id)} placeholder="Leave feedback..." className="flex-1 bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-green/50" />
                      <button onClick={() => addComment(essay.id)} className="bg-portal-green/10 border border-portal-green/30 rounded-lg px-3 py-2 text-portal-green hover:bg-portal-green/20 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
