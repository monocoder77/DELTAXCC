export type UserRole = 'student' | 'consultant';
export type EssayStatus = 'not_started' | 'draft' | 'in_review' | 'revision' | 'final' | 'submitted';
export type SchoolCategory = 'reach' | 'target' | 'safety';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  assigned_consultant_id: string | null;
  avatar_initials: string;
  email: string;
  created_at: string;
}

export interface School {
  id: string;
  student_id: string;
  name: string;
  program: string;
  category: SchoolCategory;
  decision_plan: string;
  deadline: string;
  notes: string;
  created_at: string;
  is_common_app?: boolean;
}

export interface Prompt {
  id: string;
  school_id: string;
  title: string;
  prompt_text: string;
  word_limit: number;
  sort_order: number;
}

export interface Essay {
  id: string;
  prompt_id: string;
  student_id: string;
  content: string;
  status: EssayStatus;
  word_count: number;
  updated_at: string;
}

export interface EssayComment {
  id: string;
  essay_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface Task {
  id: string;
  student_id: string;
  created_by: string;
  title: string;
  category: string;
  due_date: string;
  completed: boolean;
  completed_at: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  file_url: string | null;
  created_at: string;
  sender?: Profile;
}

export interface Conversation {
  id: string;
  student_id: string;
  consultant_id: string;
}

export interface SharedFile {
  id: string;
  uploaded_by: string;
  student_id: string;
  name: string;
  storage_path: string;
  folder: string;
  size_bytes: number;
  created_at: string;
}

export interface Activity {
  id: string;
  student_id: string;
  position_order: number;
  activity_name: string;
  activity_type: string;
  role: string;
  organization: string;
  grade_levels: string;
  timing: string;
  hours_per_week: number;
  weeks_per_year: number;
  description: string;
}

export interface PromptWithEssay extends Prompt {
  essay?: Essay;
  comments?: EssayComment[];
}

export interface SchoolWithPrompts extends School {
  prompts: PromptWithEssay[];
}
