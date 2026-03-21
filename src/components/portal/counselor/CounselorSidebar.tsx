'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CounselorTabId } from '@/app/portal/page';
import type { Profile } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';

interface CounselorSidebarProps {
  activeTab: CounselorTabId;
  onTabChange: (tab: CounselorTabId) => void;
  profile: Profile;
}

export default function CounselorSidebar({ activeTab, onTabChange, profile }: CounselorSidebarProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [reviewCount, setReviewCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function fetchBadgeCounts() {
      const supabase = getSupabase();

      // Get assigned student IDs
      const { data: students } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'student');

      const studentIds = students?.map(s => s.id) || [];
      if (studentIds.length === 0) {
        setReviewCount(0);
        setOverdueCount(0);
        setUnreadCount(0);
        return;
      }

      // Count essays awaiting review
      const { count: essayCount } = await supabase
        .from('essays')
        .select('*', { count: 'exact', head: true })
        .in('student_id', studentIds)
        .eq('status', 'in_review');
      setReviewCount(essayCount || 0);

      // Count overdue tasks
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id')
        .in('student_id', studentIds)
        .eq('completed', false)
        .lt('due_date', new Date().toISOString().split('T')[0]);
      setOverdueCount(overdueTasks?.length || 0);

      // Count unread messages (conversations where latest message is from student)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('consultant_id', profile.id);
      // For now set unread to 0 — real unread tracking requires a read_at column
      setUnreadCount(0);
    }

    fetchBadgeCounts();
  }, [profile?.id]);

  const tabGroups = [
    {
      label: 'Overview',
      tabs: [
        { id: 'c-dashboard' as CounselorTabId, name: 'Dashboard', icon: DashboardIcon, badge: 0 },
        { id: 'c-students' as CounselorTabId, name: 'My Students', icon: StudentsIcon, badge: 0 },
      ],
    },
    {
      label: 'Management',
      tabs: [
        { id: 'c-tasks' as CounselorTabId, name: 'Task Manager', icon: TasksIcon, badge: overdueCount },
        { id: 'c-reviews' as CounselorTabId, name: 'Essay Reviews', icon: ReviewsIcon, badge: reviewCount },
        { id: 'c-messages' as CounselorTabId, name: 'Messages', icon: MessagesIcon, badge: unreadCount },
      ],
    },
    {
      label: 'Tools',
      tabs: [
        { id: 'c-prompts' as CounselorTabId, name: 'Prompt Library', icon: PromptsIcon, badge: 0 },
        { id: 'c-files' as CounselorTabId, name: 'File Manager', icon: FilesIcon, badge: 0 },
        { id: 'c-settings' as CounselorTabId, name: 'Settings', icon: SettingsIcon, badge: 0 },
      ],
    },
  ];

  const handleLogout = async () => {
    await signOut();
    router.push('/portal/login');
  };

  return (
    <div className="h-full w-[250px] bg-portal-sidebar backdrop-blur-md border-r border-portal-border-subtle flex flex-col">
      <div className="px-5 py-5 border-b border-portal-border-subtle">
        <a href="/" className="text-xl font-bold text-portal-accent tracking-tight">DeltaX</a>
        <p className="text-xs text-portal-dim mt-0.5">Counselor Portal</p>
      </div>

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
                  {tab.badge > 0 && (
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-portal-dim/20 text-portal-muted">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-portal-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent/80 text-sm font-semibold">
            {profile.avatar_initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-portal-text truncate">{profile.full_name}</p>
            <p className="text-xs text-portal-dim truncate">Counselor</p>
          </div>
          <button onClick={handleLogout} className="text-portal-dim hover:text-portal-rose transition-colors" title="Sign out">
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

function DashboardIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>);
}
function StudentsIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
}
function TasksIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>);
}
function ReviewsIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>);
}
function MessagesIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
}
function PromptsIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>);
}
function FilesIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>);
}
function SettingsIcon({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>);
}
