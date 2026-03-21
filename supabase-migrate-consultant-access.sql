-- Migration: Let all counselors see all students
-- Run this in Supabase SQL Editor

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Consultants can view assigned students" ON profiles;
DROP POLICY IF EXISTS "Consultants can manage student schools" ON schools;
DROP POLICY IF EXISTS "Consultants can manage prompts" ON prompts;
DROP POLICY IF EXISTS "Consultants can view student tasks" ON tasks;

-- Consultants can view ALL profiles (students + other consultants)
CREATE POLICY "Consultants can view all students" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can manage ALL student schools
CREATE POLICY "Consultants can manage student schools" ON schools FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can manage ALL prompts
CREATE POLICY "Consultants can manage prompts" ON prompts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view/update/delete ALL tasks
CREATE POLICY "Consultants can view student tasks" ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can update student tasks" ON tasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can delete student tasks" ON tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view/update ALL essays
CREATE POLICY "Consultants can view all essays" ON essays FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can update essays" ON essays FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view ALL essay comments
CREATE POLICY "Consultants can view all essay comments" ON essay_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view ALL activities
CREATE POLICY "Consultants can view all activities" ON activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view ALL conversations and messages
CREATE POLICY "Consultants can view all conversations" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
CREATE POLICY "Consultants can view all messages" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);

-- Consultants can view ALL files
CREATE POLICY "Consultants can view all files" ON files FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'consultant')
);
