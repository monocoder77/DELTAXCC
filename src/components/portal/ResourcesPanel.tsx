'use client';

const resources = [
  {
    icon: '📝',
    title: 'Essay Writing Guide',
    description: 'Tips on crafting compelling personal statements and supplemental essays.',
  },
  {
    icon: '📊',
    title: 'School Research Toolkit',
    description: 'How to evaluate colleges based on fit, academics, culture, and outcomes.',
  },
  {
    icon: '📅',
    title: 'Application Timeline',
    description: 'Month-by-month checklist from junior year through senior year deadlines.',
  },
  {
    icon: '🎯',
    title: 'Activities Strategy',
    description: 'Build a compelling extracurricular profile that tells a coherent story.',
  },
  {
    icon: '💡',
    title: 'Interview Prep',
    description: 'Common questions, strategies, and practice tips for alumni interviews.',
  },
  {
    icon: '📮',
    title: 'Financial Aid Basics',
    description: 'Understanding FAFSA, CSS Profile, merit aid, and need-based aid.',
  },
];

export default function ResourcesPanel() {
  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Resources</h1>
        <p className="text-portal-body text-sm mt-1.5">Guides and materials to support your applications</p>
      </div>

      <div
        className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {resources.map((resource, i) => (
          <div
            key={resource.title}
            className={`flex items-start gap-4 px-5 py-4 hover:bg-portal-hover transition-colors cursor-pointer ${i > 0 ? 'border-t border-portal-border-subtle' : ''}`}
          >
            <div className="text-xl flex-shrink-0 mt-0.5">{resource.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-portal-text mb-0.5">{resource.title}</h3>
              <p className="text-xs text-portal-muted leading-relaxed">{resource.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
