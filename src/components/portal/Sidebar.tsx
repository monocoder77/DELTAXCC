'use client';

/* ==========================================================================
   Portal sidebar for students, counselors, and counselors viewing a student.
   Ruled, geometric: mono group labels, a diamond marks the active tab.
   ========================================================================== */

import type { ComponentType, SVGProps } from 'react';
import type { Profile } from '@/types/database';
import type { TabDef } from './nav';
import { Avatar, Diamond, IconButton, Kbd, cx } from './ui/primitives';
import {
  IconActivity,
  IconArrowLeft,
  IconBook,
  IconDashboard,
  IconFolder,
  IconLibrary,
  IconLogout,
  IconMessage,
  IconPen,
  IconSchool,
  IconSearch,
  IconSettings,
  IconTasks,
  IconUsers,
} from './ui/icons';

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const ICONS: Record<string, IconType> = {
  dashboard: IconDashboard,
  schools: IconSchool,
  tasks: IconTasks,
  activities: IconActivity,
  messages: IconMessage,
  files: IconFolder,
  resources: IconBook,
  settings: IconSettings,
  'c-dashboard': IconDashboard,
  'c-students': IconUsers,
  'c-reviews': IconPen,
  'c-tasks': IconTasks,
  'c-messages': IconMessage,
  'c-prompts': IconLibrary,
  'c-files': IconFolder,
  'c-settings': IconSettings,
};

export interface SidebarProps<T extends string> {
  tabs: TabDef<T>[];
  activeTab: T;
  onSelect: (tab: T) => void;
  me: Profile;
  subtitle: string;
  badges?: Partial<Record<T, { count: number; tone: 'red' | 'amber' | 'accent' }>>;
  /** Set when a counselor is viewing a student's portal. */
  viewingStudent?: Profile | null;
  onExitStudent?: () => void;
  onOpenPalette: () => void;
  onSignOut: () => void;
}

const badgeColor = {
  red: 'var(--color-portal-red)',
  amber: 'var(--color-portal-amber)',
  accent: 'var(--color-portal-accent-light)',
};

export default function Sidebar<T extends string>({
  tabs,
  activeTab,
  onSelect,
  me,
  subtitle,
  badges = {},
  viewingStudent,
  onExitStudent,
  onOpenPalette,
  onSignOut,
}: SidebarProps<T>) {
  const groups: { label: string; tabs: TabDef<T>[] }[] = [];
  tabs.forEach((tab) => {
    const group = groups.find((g) => g.label === tab.group);
    if (group) group.tabs.push(tab);
    else groups.push({ label: tab.group, tabs: [tab] });
  });

  let index = 0;

  return (
    <div className="flex h-full w-[260px] flex-col border-r border-portal-line bg-portal-bg/85 backdrop-blur-md">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-portal-line px-6 py-5">
        <a href="/" className="group">
          <span className="font-serif text-xl font-bold tracking-tight text-portal-text">DeltaX</span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-portal-muted group-hover:text-portal-accent-light">
            {subtitle}
          </span>
        </a>
        <IconButton aria-label="Search and jump (Ctrl K)" onClick={onOpenPalette}>
          <IconSearch size={16} />
        </IconButton>
      </div>

      {/* Counselor viewing a student */}
      {viewingStudent && (
        <div className="border-b border-portal-line px-6 py-4">
          <button
            type="button"
            onClick={onExitStudent}
            className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted hover:text-portal-text"
          >
            <IconArrowLeft size={12} /> All students
          </button>
          <div className="flex items-center gap-3">
            <Avatar initials={viewingStudent.avatar_initials} size={30} tone="gold" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-portal-text">{viewingStudent.full_name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-gold">Student view</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="portal-scroll flex-1 overflow-y-auto px-3 py-5" aria-label="Portal">
        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            <p className="mb-2 flex items-center gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-portal-dim">
              {group.label}
              <span className="h-px flex-1 bg-portal-line" />
            </p>
            <ul>
              {group.tabs.map((tab) => {
                index += 1;
                const active = tab.id === activeTab;
                const Icon = ICONS[tab.id] ?? IconDashboard;
                const badge = badges[tab.id];
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(tab.id)}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                        active ? 'bg-portal-select text-portal-text' : 'text-portal-muted hover:bg-portal-hover hover:text-portal-text',
                      )}
                    >
                      {active && <span className="absolute inset-y-0 left-0 w-[2px] bg-portal-accent" aria-hidden="true" />}
                      <span className="w-5 font-mono text-[10px] text-portal-dim">{String(index).padStart(2, '0')}</span>
                      <Icon size={16} className={active ? 'text-portal-accent-light' : ''} />
                      <span className={cx('flex-1 truncate', active && 'font-medium')}>{tab.label}</span>
                      {badge && badge.count > 0 ? (
                        <span
                          className="inline-flex h-5 min-w-5 items-center justify-center border px-1 font-mono text-[10px] tabular-nums"
                          style={{ color: badgeColor[badge.tone], borderColor: `color-mix(in srgb, ${badgeColor[badge.tone]} 50%, transparent)` }}
                          aria-label={`${badge.count} need attention`}
                        >
                          {badge.count}
                        </span>
                      ) : active ? (
                        <Diamond size={6} />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <button
          type="button"
          onClick={onOpenPalette}
          className="mx-3 mt-2 hidden w-[calc(100%-1.5rem)] items-center justify-between border border-dashed border-portal-line-strong px-3 py-2 text-xs text-portal-muted hover:border-portal-accent-light hover:text-portal-text lg:flex"
        >
          <span className="flex items-center gap-2">
            <IconSearch size={13} /> Jump to...
          </span>
          <span className="flex gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </nav>

      {/* Me */}
      <div className="flex items-center gap-3 border-t border-portal-line px-5 py-4">
        <Avatar initials={me.avatar_initials} size={34} tone={me.role === 'consultant' ? 'accent' : 'gold'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-portal-text">{me.full_name}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
            {me.role === 'consultant' ? 'Counselor' : 'Student'}
          </p>
        </div>
        <IconButton aria-label="Sign out" tone="danger" onClick={onSignOut}>
          <IconLogout size={16} />
        </IconButton>
      </div>
    </div>
  );
}
