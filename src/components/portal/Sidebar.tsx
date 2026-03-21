'use client';

import { useRouter } from 'next/navigation';
import type { TabId } from '@/app/portal/page';
import type { Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  profile: Profile;
}

const tabGroups = [
  {
    label: 'Overview',
    tabs: [
      { id: 'dashboard' as TabId, name: 'Dashboard', icon: DashboardIcon },
    ],
  },
  {
    label: 'Applications',
    tabs: [
      { id: 'schools' as TabId, name: 'Schools & Essays', icon: SchoolsIcon },
      { id: 'tasks' as TabId, name: 'Tasks', icon: TasksIcon },
      { id: 'activities' as TabId, name: 'Activities', icon: ActivitiesIcon },
    ],
  },
  {
    label: 'Communication',
    tabs: [
      { id: 'messages' as TabId, name: 'Messages', icon: MessagesIcon },
      { id: 'files' as TabId, name: 'Shared Files', icon: FilesIcon },
    ],
  },
  {
    label: 'Help',
    tabs: [
      { id: 'resources' as TabId, name: 'Resources', icon: ResourcesIcon },
      { id: 'settings' as TabId, name: 'Settings', icon: SettingsIcon },
    ],
  },
];

export default function Sidebar({ activeTab, onTabChange, profile }: SidebarProps) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/portal/login');
  };

  return (
    <div className="h-full w-[250px] bg-portal-sidebar backdrop-blur-md border-r border-portal-border-subtle flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-portal-border-subtle">
        <a href="/" className="text-xl font-bold text-portal-accent tracking-tight">DeltaX</a>
        <p className="text-xs text-portal-dim mt-0.5">Student Portal</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto portal-scroll py-4 px-3">
        {tabGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-portal-dim font-medium px-3 mb-2">
              {group.label}
            </p>
            {group.tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 relative ${
                    isActive
                      ? 'bg-portal-sidebar-active text-portal-text'
                      : 'text-portal-muted/60 hover:text-portal-muted hover:bg-portal-hover'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-portal-accent rounded-r-full" />
                  )}
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span className={isActive ? 'font-medium' : ''}>{tab.name}</span>
                  {tab.id === 'messages' && (
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-portal-dim/20 text-portal-muted">
                      3
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-portal-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent/80 text-sm font-semibold">
            {profile.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-portal-text truncate">{profile.full_name}</p>
            <p className="text-xs text-portal-dim truncate">{profile.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-portal-dim hover:text-portal-rose transition-colors"
            title="Sign out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Icon components
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SchoolsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ActivitiesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FilesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ResourcesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
