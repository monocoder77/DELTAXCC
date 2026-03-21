'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/portal/Sidebar';
import CounselorSidebar from '@/components/portal/counselor/CounselorSidebar';
import DashboardPanel from '@/components/portal/DashboardPanel';
import SchoolsPanel from '@/components/portal/SchoolsPanel';
import TasksPanel from '@/components/portal/TasksPanel';
import ActivitiesPanel from '@/components/portal/ActivitiesPanel';
import MessagesPanel from '@/components/portal/MessagesPanel';
import FilesPanel from '@/components/portal/FilesPanel';
import ResourcesPanel from '@/components/portal/ResourcesPanel';
import SettingsPanel from '@/components/portal/SettingsPanel';
import CounselorDashboard from '@/components/portal/counselor/CounselorDashboard';
import MyStudentsPanel from '@/components/portal/counselor/MyStudentsPanel';
import TaskManagerPanel from '@/components/portal/counselor/TaskManagerPanel';
import EssayReviewsPanel from '@/components/portal/counselor/EssayReviewsPanel';
import CounselorMessagesPanel from '@/components/portal/counselor/CounselorMessagesPanel';
import PromptLibraryPanel from '@/components/portal/counselor/PromptLibraryPanel';
import FileManagerPanel from '@/components/portal/counselor/FileManagerPanel';
import CounselorSettingsPanel from '@/components/portal/counselor/CounselorSettingsPanel';
import StudentViewWrapper from '@/components/portal/counselor/StudentViewWrapper';

export type TabId = 'dashboard' | 'schools' | 'tasks' | 'activities' | 'messages' | 'files' | 'resources' | 'settings';
export type CounselorTabId = 'c-dashboard' | 'c-students' | 'c-tasks' | 'c-reviews' | 'c-messages' | 'c-prompts' | 'c-files' | 'c-settings';

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [counselorTab, setCounselorTab] = useState<CounselorTabId>('c-dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const router = useRouter();

  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/portal/login');
    }
  }, [user, loading, router]);

  // Show spinner while loading or no user yet
  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-portal-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = profile.role;

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleCounselorTabChange = (tab: CounselorTabId) => {
    setCounselorTab(tab);
    setViewingStudentId(null);
    setMobileMenuOpen(false);
  };

  const handleViewStudent = (studentId: string) => {
    setViewingStudentId(studentId);
    setActiveTab('dashboard');
  };

  const handleBackToRoster = () => {
    setViewingStudentId(null);
    setCounselorTab('c-students');
  };

  // Student panels
  const studentPanels: Record<TabId, React.ReactNode> = {
    dashboard: <DashboardPanel onNavigate={handleTabChange} />,
    schools: <SchoolsPanel />,
    tasks: <TasksPanel />,
    activities: <ActivitiesPanel />,
    messages: <MessagesPanel />,
    files: <FilesPanel />,
    resources: <ResourcesPanel />,
    settings: <SettingsPanel />,
  };

  // Counselor panels
  const counselorPanels: Record<CounselorTabId, React.ReactNode> = {
    'c-dashboard': <CounselorDashboard onNavigate={handleCounselorTabChange} onViewStudent={handleViewStudent} />,
    'c-students': <MyStudentsPanel onViewStudent={handleViewStudent} />,
    'c-tasks': <TaskManagerPanel />,
    'c-reviews': <EssayReviewsPanel />,
    'c-messages': <CounselorMessagesPanel />,
    'c-prompts': <PromptLibraryPanel />,
    'c-files': <FileManagerPanel />,
    'c-settings': <CounselorSettingsPanel />,
  };

  // Counselor viewing a specific student
  if (role === 'consultant' && viewingStudentId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] font-[family-name:var(--font-libre)]">
        <StudentViewWrapper
          studentId={viewingStudentId}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onBack={handleBackToRoster}
        />
      </div>
    );
  }

  // Counselor portal
  if (role === 'consultant') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] font-[family-name:var(--font-libre)]">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[rgba(26,10,46,0.95)] backdrop-blur-md border-b border-portal-border">
          <span className="text-lg font-bold text-portal-green">DeltaX</span>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-portal-muted p-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
            </svg>
          </button>
        </div>

        <div className="flex h-screen">
          <div className={`fixed inset-y-0 left-0 z-40 w-[250px] transform transition-transform duration-200 lg:relative lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <CounselorSidebar activeTab={counselorTab} onTabChange={handleCounselorTabChange} profile={profile} />
          </div>
          {mobileMenuOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
          <main className="flex-1 overflow-hidden">
            <div className="h-screen overflow-y-auto portal-scroll">
              {counselorPanels[counselorTab]}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Student portal
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] font-[family-name:var(--font-libre)]">
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[rgba(26,10,46,0.95)] backdrop-blur-md border-b border-portal-border">
        <span className="text-lg font-bold text-portal-accent">DeltaX</span>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-portal-muted p-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>
      </div>

      <div className="flex h-screen">
        <div className={`fixed inset-y-0 left-0 z-40 w-[250px] transform transition-transform duration-200 lg:relative lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar activeTab={activeTab} onTabChange={handleTabChange} profile={profile} />
        </div>
        {mobileMenuOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
        <main className="flex-1 overflow-hidden">
          <div className="h-screen overflow-y-auto portal-scroll">
            {studentPanels[activeTab]}
          </div>
        </main>
      </div>
    </div>
  );
}
