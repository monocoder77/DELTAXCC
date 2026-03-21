'use client';

const folders = [
  {
    name: 'Essays',
    files: [
      { name: 'Common App Personal Statement v3.docx', date: 'Oct 15, 2024', size: '24 KB' },
      { name: 'Cornell Why Us Draft.docx', date: 'Oct 12, 2024', size: '18 KB' },
      { name: 'UT Austin Essay Final.docx', date: 'Oct 20, 2024', size: '22 KB' },
    ],
  },
  {
    name: 'Resources from Consultant',
    files: [
      { name: 'Essay Brainstorming Worksheet.pdf', date: 'Sep 5, 2024', size: '156 KB' },
      { name: 'School List Strategy Guide.pdf', date: 'Sep 1, 2024', size: '340 KB' },
      { name: 'Activities List Template.xlsx', date: 'Sep 10, 2024', size: '45 KB' },
    ],
  },
];

const fileIcons: Record<string, string> = {
  docx: 'text-blue-400',
  pdf: 'text-portal-red',
  xlsx: 'text-portal-green',
};

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export default function FilesPanel() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Shared Files</h1>
          <p className="text-portal-body text-sm mt-1.5">Documents shared between you and your consultant</p>
        </div>
        <button className="bg-portal-accent hover:bg-portal-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-md transition-colors flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>
      </div>

      <div className="space-y-6">
        {folders.map(folder => (
          <div key={folder.name}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-portal-accent">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading">{folder.name}</h3>
            </div>

            <div
              className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {folder.files.map((file, i) => {
                const ext = getExtension(file.name);
                const iconColor = fileIcons[ext] || 'text-portal-muted';
                return (
                  <div
                    key={file.name}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-portal-hover transition-colors ${
                      i > 0 ? 'border-t border-portal-border-subtle' : ''
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={iconColor}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-sm text-portal-text flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] hidden sm:inline">{file.date}</span>
                    <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)]">{file.size}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
