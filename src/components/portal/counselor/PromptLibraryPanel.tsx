'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Prompt, School } from '@/types/database';

interface LibraryPrompt extends Prompt {
  school_name: string;
}

export default function PromptLibraryPanel() {
  const { profile } = useAuth();
  const [prompts, setPrompts] = useState<LibraryPrompt[]>([]);
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      // Get all students assigned to this counselor
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student');

      const ids = students?.map(s => s.id) || [];
      if (ids.length === 0) { setLoading(false); return; }

      // Get all schools for those students
      const { data: schoolData } = await supabase
        .from('schools')
        .select('*')
        .in('student_id', ids);

      const schoolList = (schoolData as School[]) || [];
      const schoolIds = schoolList.map(s => s.id);
      if (schoolIds.length === 0) { setLoading(false); return; }

      // Get all prompts for those schools
      const { data: promptData } = await supabase
        .from('prompts')
        .select('*')
        .in('school_id', schoolIds)
        .order('sort_order', { ascending: true });

      const promptList = ((promptData as Prompt[]) || []).map(p => ({
        ...p,
        school_name: schoolList.find(s => s.id === p.school_id)?.name || 'Unknown School',
      }));

      setPrompts(promptList);
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  // Group by school
  const grouped: Record<string, LibraryPrompt[]> = {};
  prompts.forEach(p => {
    const key = p.school_name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const schools = Object.keys(grouped).sort();

  const updatePrompt = async (id: string, updates: Partial<LibraryPrompt>) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const supabase = getSupabase();
    const { school_name, ...dbUpdates } = updates as any;
    await supabase.from('prompts').update(dbUpdates).eq('id', id);
  };

  const deletePrompt = async (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
    setEditingId(null);
    const supabase = getSupabase();
    await supabase.from('prompts').delete().eq('id', id);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Prompt Library</h1>
        <p className="text-portal-body text-sm mt-1.5">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Prompt Library</h1>
        <p className="text-portal-body text-sm mt-1.5">Essay prompts organized by school across all students</p>
      </div>

      {schools.length === 0 ? (
        <p className="text-sm text-portal-muted">No prompts yet. Prompts will appear here when students add schools.</p>
      ) : (
        <div className="space-y-3">
          {schools.map(schoolName => {
            const isExpanded = expandedSchool === schoolName;
            const schoolPrompts = grouped[schoolName];

            return (
              <div key={schoolName} className="bg-portal-surface border border-portal-border-subtle rounded-lg overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <button
                  onClick={() => setExpandedSchool(isExpanded ? null : schoolName)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-portal-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-portal-text">{schoolName}</h3>
                    <span className="text-xs text-portal-dim">{schoolPrompts.length} prompt{schoolPrompts.length !== 1 ? 's' : ''}</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-portal-dim transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-portal-border-subtle">
                    {schoolPrompts.map(prompt => {
                      const isEditing = editingId === prompt.id;
                      return (
                        <div key={prompt.id} className="px-5 py-4 border-b border-portal-border-subtle last:border-b-0">
                          {isEditing ? (
                            <div className="space-y-3">
                              <input value={prompt.title} onChange={e => updatePrompt(prompt.id, { title: e.target.value })} className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" placeholder="Prompt title" />
                              <textarea value={prompt.prompt_text} onChange={e => updatePrompt(prompt.id, { prompt_text: e.target.value })} rows={3} className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-green/50 resize-none" placeholder="Prompt text" />
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-portal-muted">Word limit:</label>
                                  <input type="number" value={prompt.word_limit} onChange={e => updatePrompt(prompt.id, { word_limit: parseInt(e.target.value) || 500 })} className="w-20 bg-portal-bg border border-portal-border-subtle rounded-lg px-2 py-1.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
                                </div>
                                <div className="ml-auto flex gap-2">
                                  <button onClick={() => deletePrompt(prompt.id)} className="text-xs text-portal-rose hover:text-portal-rose/80 transition-colors">Delete</button>
                                  <button onClick={() => setEditingId(null)} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-portal-green text-white hover:bg-portal-green/90 transition-colors">Done</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-medium text-portal-text">{prompt.title}</p>
                                  <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)]">{prompt.word_limit}w</span>
                                </div>
                                <p className="text-xs text-portal-muted line-clamp-2">{prompt.prompt_text}</p>
                              </div>
                              <button onClick={() => setEditingId(prompt.id)} className="text-xs text-portal-muted hover:text-portal-green transition-colors flex-shrink-0 ml-4 border border-portal-border-subtle px-2 py-1 rounded-md hover:border-portal-green/30">
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
