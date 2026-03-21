'use client';

import { useState, useEffect } from 'react';
import { useSchools, usePromptsForSchool } from '@/lib/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { School, EssayStatus, Prompt, Essay } from '@/types/database';
import SchoolDetail from './SchoolDetail';

const categoryColors: Record<string, { bg: string; text: string }> = {
  reach: { bg: 'bg-portal-rose/12', text: 'text-portal-rose' },
  target: { bg: 'bg-portal-amber/12', text: 'text-portal-amber' },
  safety: { bg: 'bg-portal-green/12', text: 'text-portal-green' },
};

function getStatusLabel(status: EssayStatus) {
  const map: Record<EssayStatus, { label: string; color: string }> = {
    not_started: { label: 'Not Started', color: 'text-portal-dim' },
    draft: { label: 'Draft', color: 'text-portal-amber' },
    in_review: { label: 'In Review', color: 'text-portal-accent/80' },
    revision: { label: 'Revision', color: 'text-portal-amber' },
    final: { label: 'Final', color: 'text-portal-green' },
    submitted: { label: 'Submitted', color: 'text-portal-green' },
  };
  return map[status];
}

function SchoolDetailWrapper({ school, onBack }: { school: School; onBack: () => void }) {
  const { prompts } = usePromptsForSchool(school.id);
  return <SchoolDetail school={school} prompts={prompts} onBack={onBack} />;
}

// Fetch all prompts + essays for the school list summary
function useSchoolSummaries(schools: School[]) {
  const [promptsBySchool, setPromptsBySchool] = useState<Record<string, (Prompt & { essay?: Essay })[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (schools.length === 0) {
      setPromptsBySchool({});
      setLoading(false);
      return;
    }

    const schoolIds = schools.map(s => s.id);
    const supabase = getSupabase();

    supabase
      .from('prompts')
      .select('*, essays(*)')
      .in('school_id', schoolIds)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const grouped: Record<string, (Prompt & { essay?: Essay })[]> = {};
        if (data) {
          for (const p of data as any[]) {
            const schoolId = p.school_id;
            if (!grouped[schoolId]) grouped[schoolId] = [];
            grouped[schoolId].push({ ...p, essay: p.essays?.[0], essays: undefined });
          }
        }
        setPromptsBySchool(grouped);
        setLoading(false);
      });
  }, [schools]);

  return { promptsBySchool, loading };
}

export default function SchoolsPanel() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const { schools } = useSchools();
  const { promptsBySchool } = useSchoolSummaries(schools);

  if (selectedSchool) {
    return <SchoolDetailWrapper school={selectedSchool} onBack={() => setSelectedSchool(null)} />;
  }

  const sortedSchools = [...schools].sort((a, b) => {
    if (a.is_common_app) return -1;
    if (b.is_common_app) return 1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Schools & Essays</h1>
          <p className="text-portal-body text-sm mt-1.5">Manage your applications and essay prompts</p>
        </div>
        <button className="bg-portal-accent hover:bg-portal-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-md transition-colors flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add School
        </button>
      </div>

      {sortedSchools.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-portal-muted">No schools added yet. Click &ldquo;Add School&rdquo; to get started.</p>
        </div>
      ) : (
        <div
          className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {sortedSchools.map((school, i) => {
            const prompts = promptsBySchool[school.id] || [];
            const startedCount = prompts.filter(p => p.essay && p.essay.status !== 'not_started').length;
            const colors = categoryColors[school.category] || categoryColors.target;

            return (
              <button
                key={school.id}
                onClick={() => setSelectedSchool(school)}
                className={`w-full text-left px-5 py-4 hover:bg-portal-hover transition-colors ${i > 0 ? 'border-t border-portal-border-subtle' : ''}`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-portal-text">{school.name}</h3>
                      {!school.is_common_app && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${colors.bg} ${colors.text} flex-shrink-0`}>
                          {school.category.charAt(0).toUpperCase() + school.category.slice(1)}
                        </span>
                      )}
                      {school.is_common_app && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-portal-accent/10 text-portal-accent/80 flex-shrink-0">
                          Common App
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-portal-body">{school.program}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-portal-dim flex-shrink-0 mt-1">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  {school.deadline && (
                    <span className="text-portal-muted font-[family-name:var(--font-space-mono)]">
                      {school.decision_plan} — {new Date(school.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <span className="text-portal-dim">
                    {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} · {startedCount}/{prompts.length} started
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {prompts.slice(0, 4).map(prompt => {
                    const status = prompt.essay ? getStatusLabel(prompt.essay.status) : getStatusLabel('not_started');
                    return (
                      <div key={prompt.id} className="flex items-center gap-1.5">
                        <span className="text-xs text-portal-muted truncate max-w-[140px]">{prompt.title}</span>
                        <span className={`text-[10px] font-medium ${status.color}`}>{status.label}</span>
                      </div>
                    );
                  })}
                  {prompts.length > 4 && (
                    <span className="text-xs text-portal-dim">+{prompts.length - 4} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
