-- ============================================================================
-- DeltaX Portal v2: database update
-- Run once in the Supabase SQL Editor. Safe to run more than once.
--
-- What it does:
--  1. Replaces the counselor policies that query `profiles` from inside a
--     `profiles` policy (which can fail with "infinite recursion detected")
--     with a SECURITY DEFINER helper, public.is_consultant().
--  2. Lets students see their counselors' names (comment authors, message
--     senders, chat header).
--  3. Lets people edit their own name (not their role or assignment).
--  4. Lets students add and remove their own personal tasks, and stops
--     students from creating tasks for other students.
--  5. Restricts messages and comments to people who belong to that
--     conversation or essay.
--  6. Lets counselors start conversations and add prompts/essays for students.
--  7. Enables essay version history.
--  8. Enables file uploads (private Storage bucket "student-files").
--  9. Enables realtime delivery for messages.
-- ============================================================================

-- 1. Helper: is the current user a counselor? -------------------------------
CREATE OR REPLACE FUNCTION public.is_consultant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'consultant'
  );
$$;

REVOKE ALL ON FUNCTION public.is_consultant() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_consultant() TO anon, authenticated;

-- Profiles -------------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all students" ON profiles;
CREATE POLICY "Consultants can view all students" ON profiles
  FOR SELECT USING (public.is_consultant());

-- 2. Everyone signed in can see counselor profiles (names, initials).
DROP POLICY IF EXISTS "Anyone signed in can view counselors" ON profiles;
CREATE POLICY "Anyone signed in can view counselors" ON profiles
  FOR SELECT TO authenticated USING (role = 'consultant');

-- 3. People can update their own name and initials only.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_initials) ON profiles TO authenticated;

-- Schools / prompts -------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can manage student schools" ON schools;
CREATE POLICY "Consultants can manage student schools" ON schools
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can manage prompts" ON prompts;
CREATE POLICY "Consultants can manage prompts" ON prompts
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- Essays ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all essays" ON essays;
CREATE POLICY "Consultants can view all essays" ON essays
  FOR SELECT USING (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can update essays" ON essays;
CREATE POLICY "Consultants can update essays" ON essays
  FOR UPDATE USING (public.is_consultant()) WITH CHECK (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can create essays" ON essays;
CREATE POLICY "Consultants can create essays" ON essays
  FOR INSERT WITH CHECK (public.is_consultant());

-- 7. Essay versions (history)
DROP POLICY IF EXISTS "Students can manage own essay versions" ON essay_versions;
CREATE POLICY "Students can manage own essay versions" ON essay_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM essays e WHERE e.id = essay_versions.essay_id AND e.student_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM essays e WHERE e.id = essay_versions.essay_id AND e.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "Consultants can manage essay versions" ON essay_versions;
CREATE POLICY "Consultants can manage essay versions" ON essay_versions
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- Comments ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all essay comments" ON essay_comments;
CREATE POLICY "Consultants can view all essay comments" ON essay_comments
  FOR SELECT USING (public.is_consultant());

-- 5. Only the essay's student or a counselor can comment, as themselves.
DROP POLICY IF EXISTS "Users can add comments" ON essay_comments;
CREATE POLICY "Users can add comments" ON essay_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_consultant()
      OR EXISTS (SELECT 1 FROM essays e WHERE e.id = essay_comments.essay_id AND e.student_id = auth.uid())
    )
  );

-- Tasks -------------------------------------------------------------------------
-- 4. Counselors create tasks for anyone; students only for themselves.
DROP POLICY IF EXISTS "Consultants can create tasks" ON tasks;
CREATE POLICY "Consultants can create tasks" ON tasks
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND (public.is_consultant() OR auth.uid() = student_id)
  );

DROP POLICY IF EXISTS "Students can delete own personal tasks" ON tasks;
CREATE POLICY "Students can delete own personal tasks" ON tasks
  FOR DELETE USING (auth.uid() = student_id AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Consultants can view student tasks" ON tasks;
CREATE POLICY "Consultants can view student tasks" ON tasks
  FOR SELECT USING (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can update student tasks" ON tasks;
CREATE POLICY "Consultants can update student tasks" ON tasks
  FOR UPDATE USING (public.is_consultant()) WITH CHECK (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can delete student tasks" ON tasks;
CREATE POLICY "Consultants can delete student tasks" ON tasks
  FOR DELETE USING (public.is_consultant());

-- Activities ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all activities" ON activities;
CREATE POLICY "Consultants can view all activities" ON activities
  FOR SELECT USING (public.is_consultant());

DROP POLICY IF EXISTS "Consultants can manage activities" ON activities;
CREATE POLICY "Consultants can manage activities" ON activities
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- Conversations / messages ----------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all conversations" ON conversations;
CREATE POLICY "Consultants can view all conversations" ON conversations
  FOR SELECT USING (public.is_consultant());

-- 6. Counselors can open a conversation with a student, as themselves.
DROP POLICY IF EXISTS "Consultants can start conversations" ON conversations;
CREATE POLICY "Consultants can start conversations" ON conversations
  FOR INSERT WITH CHECK (public.is_consultant() AND auth.uid() = consultant_id);

DROP POLICY IF EXISTS "Consultants can view all messages" ON messages;
CREATE POLICY "Consultants can view all messages" ON messages
  FOR SELECT USING (public.is_consultant());

-- 5. Only conversation members (or counselors) can post, as themselves.
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      public.is_consultant()
      OR EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = messages.conversation_id AND (c.student_id = auth.uid() OR c.consultant_id = auth.uid())
      )
    )
  );

-- Files -------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Consultants can view all files" ON files;
CREATE POLICY "Consultants can view all files" ON files
  FOR SELECT USING (public.is_consultant());

DROP POLICY IF EXISTS "Users can add files" ON files;
CREATE POLICY "Users can add files" ON files
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND (auth.uid() = student_id OR public.is_consultant())
  );

DROP POLICY IF EXISTS "Users can delete files" ON files;
CREATE POLICY "Users can delete files" ON files
  FOR DELETE USING (auth.uid() = uploaded_by OR public.is_consultant());

-- 8. Private storage bucket. Objects live under "<student_id>/<file>".
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-files', 'student-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Student files: read" ON storage.objects;
CREATE POLICY "Student files: read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'student-files'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_consultant())
  );

DROP POLICY IF EXISTS "Student files: upload" ON storage.objects;
CREATE POLICY "Student files: upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'student-files'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_consultant())
  );

DROP POLICY IF EXISTS "Student files: delete" ON storage.objects;
CREATE POLICY "Student files: delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'student-files'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_consultant())
  );

-- 9. Realtime for messages ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
