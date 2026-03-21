-- DeltaX Student Portal — Supabase Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('student', 'consultant')) DEFAULT 'student',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  assigned_consultant_id UUID REFERENCES profiles(id),
  avatar_initials TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schools
CREATE TABLE schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  program TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('reach', 'target', 'safety')),
  decision_plan TEXT DEFAULT '',
  deadline DATE,
  notes TEXT DEFAULT '',
  is_common_app BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompts (essay prompts per school)
CREATE TABLE prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  word_limit INTEGER DEFAULT 650,
  sort_order INTEGER DEFAULT 1
);

-- Essays
CREATE TABLE essays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('not_started', 'draft', 'in_review', 'revision', 'final', 'submitted')) DEFAULT 'not_started',
  word_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Essay Versions (for revision history)
CREATE TABLE essay_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id UUID REFERENCES essays(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Essay Comments
CREATE TABLE essay_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id UUID REFERENCES essays(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  due_date DATE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ
);

-- Activities
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  position_order INTEGER NOT NULL,
  activity_name TEXT NOT NULL,
  activity_type TEXT DEFAULT 'Other',
  role TEXT DEFAULT '',
  organization TEXT DEFAULT '',
  grade_levels TEXT DEFAULT '',
  timing TEXT DEFAULT '',
  hours_per_week INTEGER DEFAULT 0,
  weeks_per_year INTEGER DEFAULT 0,
  description TEXT DEFAULT ''
);

-- Conversations
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  consultant_id UUID REFERENCES profiles(id) NOT NULL
);

-- Messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Files
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  folder TEXT DEFAULT 'General',
  size_bytes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Common App Essay (special table for personal statement)
CREATE TABLE common_app_essay (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  prompt_text TEXT DEFAULT '',
  content TEXT DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('not_started', 'draft', 'in_review', 'revision', 'final', 'submitted')) DEFAULT 'not_started',
  word_count INTEGER DEFAULT 0,
  word_limit INTEGER DEFAULT 650,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE essays ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE essay_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_app_essay ENABLE ROW LEVEL SECURITY;

-- Students can read their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

-- Students can view/edit their own schools
CREATE POLICY "Students can manage own schools" ON schools FOR ALL USING (auth.uid() = student_id);

-- Students can view prompts for their schools
CREATE POLICY "Students can view own prompts" ON prompts FOR SELECT USING (
  EXISTS (SELECT 1 FROM schools WHERE schools.id = prompts.school_id AND schools.student_id = auth.uid())
);

-- Students can manage their own essays
CREATE POLICY "Students can manage own essays" ON essays FOR ALL USING (auth.uid() = student_id);

-- Students can view comments on their essays
CREATE POLICY "Students can view own essay comments" ON essay_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM essays WHERE essays.id = essay_comments.essay_id AND essays.student_id = auth.uid())
);

-- Students can add comments
CREATE POLICY "Users can add comments" ON essay_comments FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Students can manage own tasks
CREATE POLICY "Students can view own tasks" ON tasks FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = student_id);

-- Students can manage own activities
CREATE POLICY "Students can manage own activities" ON activities FOR ALL USING (auth.uid() = student_id);

-- Message access
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (
  auth.uid() = student_id OR auth.uid() = consultant_id
);

CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.student_id = auth.uid() OR conversations.consultant_id = auth.uid()))
);

CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- File access
CREATE POLICY "Users can view own files" ON files FOR SELECT USING (auth.uid() = student_id OR auth.uid() = uploaded_by);

-- Consultant policies: consultants can see ALL students' data
CREATE POLICY "Consultants can view all students" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can manage student schools" ON schools FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can manage prompts" ON prompts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can create tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Consultants can view student tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can update student tasks" ON tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can delete student tasks" ON tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all essays" ON essays FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can update essays" ON essays FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all essay comments" ON essay_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all activities" ON activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all conversations" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

CREATE POLICY "Consultants can view all files" ON files FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
