'use client';

import { useState } from 'react';
import type { School, PromptWithEssay, EssayStatus } from '@/types/database';
import EssayEditor from './EssayEditor';

interface SchoolDetailProps {
  school: School;
  prompts: PromptWithEssay[];
  onBack: () => void;
}

const statusConfig: Record<EssayStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: 'text-portal-dim', bg: 'bg-portal-dim/10' },
  draft: { label: 'Draft', color: 'text-portal-amber', bg: 'bg-portal-amber/10' },
  in_review: { label: 'In Review', color: 'text-portal-accent', bg: 'bg-portal-accent/10' },
  revision: { label: 'Revision', color: 'text-portal-amber', bg: 'bg-portal-amber/10' },
  final: { label: 'Final', color: 'text-portal-green', bg: 'bg-portal-green/10' },
  submitted: { label: 'Submitted', color: 'text-portal-green', bg: 'bg-portal-green/10' },
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  reach: { bg: 'bg-portal-rose/12', text: 'text-portal-rose' },
  target: { bg: 'bg-portal-amber/12', text: 'text-portal-amber' },
  safety: { bg: 'bg-portal-green/12', text: 'text-portal-green' },
};

export default function SchoolDetail({ school, prompts, onBack }: SchoolDetailProps) {
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const colors = categoryColors[school.category] || categoryColors.target;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-portal-muted hover:text-portal-accent text-sm mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Schools
      </button>

      {/* School Header */}
      <div className="mb-8">
        <div className="flex items-start gap-3 mb-2">
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">{school.name}</h1>
          {!school.is_common_app && (
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${colors.bg} ${colors.text} mt-1`}>
              {school.category.charAt(0).toUpperCase() + school.category.slice(1)}
            </span>
          )}
        </div>
        <p className="text-portal-body">{school.program}</p>
        {school.deadline && (
          <p className="text-sm text-portal-dim mt-1 font-[family-name:var(--font-space-mono)]">
            {school.decision_plan} — Due {new Date(school.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Essay Prompts Accordion */}
      <div
        className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle divide-y divide-portal-border-subtle"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {prompts.map(prompt => {
          const isExpanded = expandedPrompt === prompt.id;
          const essay = prompt.essay;
          const status = essay ? essay.status : 'not_started' as EssayStatus;
          const sc = statusConfig[status];
          const isReadOnly = status === 'submitted';

          return (
            <div
              key={prompt.id}
              className="overflow-hidden"
            >
              {/* Header - always visible */}
              <button
                onClick={() => setExpandedPrompt(isExpanded ? null : prompt.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-portal-hover transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-portal-text truncate">{prompt.title}</h3>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${sc.bg} ${sc.color} flex-shrink-0`}>
                    {sc.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                  <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)]">
                    {essay?.word_count || 0} / {prompt.word_limit}
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-portal-dim transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="border-t border-portal-border-subtle">
                  {/* Prompt Text */}
                  <div className="px-5 py-4 bg-portal-bg/50">
                    <blockquote className="text-sm text-portal-muted italic border-l-2 border-portal-accent/30 pl-4">
                      {prompt.prompt_text}
                    </blockquote>
                  </div>

                  {/* Editor or Read-only */}
                  {isReadOnly ? (
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium text-portal-green bg-portal-green/10 px-2 py-1 rounded-md">
                          Submitted
                        </span>
                        <span className="text-xs text-portal-dim">This essay has been finalized and submitted.</span>
                      </div>
                      <div
                        className="text-sm text-portal-text leading-relaxed prose prose-invert"
                        dangerouslySetInnerHTML={{ __html: essay?.content || '' }}
                      />
                    </div>
                  ) : (
                    <EssayEditor
                      essay={essay || undefined}
                      prompt={prompt}
                      comments={prompt.comments || []}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
