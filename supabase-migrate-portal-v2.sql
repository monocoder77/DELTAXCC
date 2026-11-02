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
-- 10. Server-side rules: one essay per prompt per student, submitted essays
--     are locked, students can only move essays forward through review, and
--     students cannot rewrite tasks their counselor assigned.
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

-- Students may delete a stored file only if they uploaded it (matching the
-- files table rule), or if it is an orphan in their folder with no files row.
DROP POLICY IF EXISTS "Student files: delete" ON storage.objects;
CREATE POLICY "Student files: delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'student-files'
    AND (
      public.is_consultant()
      OR EXISTS (
        SELECT 1 FROM public.files f
        WHERE f.storage_path = storage.objects.name AND f.uploaded_by = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND NOT EXISTS (SELECT 1 FROM public.files f WHERE f.storage_path = storage.objects.name)
      )
    )
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

-- 10. Server-side rules ---------------------------------------------------------------

-- One essay per prompt per student. Merge any existing duplicates first:
-- keep the most recently updated row and move comments/versions onto it.
WITH ranked AS (
  SELECT id,
         first_value(id) OVER w AS keep_id,
         row_number() OVER w AS rn
  FROM essays
  WINDOW w AS (PARTITION BY prompt_id, student_id ORDER BY updated_at DESC NULLS LAST, id)
)
UPDATE essay_comments c SET essay_id = r.keep_id FROM ranked r WHERE c.essay_id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         first_value(id) OVER w AS keep_id,
         row_number() OVER w AS rn
  FROM essays
  WINDOW w AS (PARTITION BY prompt_id, student_id ORDER BY updated_at DESC NULLS LAST, id)
)
UPDATE essay_versions v SET essay_id = r.keep_id FROM ranked r WHERE v.essay_id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY prompt_id, student_id ORDER BY updated_at DESC NULLS LAST, id) AS rn
  FROM essays
)
DELETE FROM essays e USING ranked r WHERE e.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS essays_prompt_student_key ON essays (prompt_id, student_id);

-- Essay rules for students (counselors are unrestricted):
--  * a submitted essay cannot be edited
--  * status can only move forward through review:
--    not_started -> draft | in_review, draft -> in_review,
--    revision -> in_review, final -> submitted
CREATE OR REPLACE FUNCTION public.enforce_student_essay_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_consultant() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.prompt_id IS DISTINCT FROM OLD.prompt_id THEN
    RAISE EXCEPTION 'Essays cannot be moved to another prompt or student.' USING ERRCODE = '42501';
  END IF;

  IF OLD.status = 'submitted'
     AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.word_count IS DISTINCT FROM OLD.word_count) THEN
    RAISE EXCEPTION 'This essay has been submitted and is locked. Ask your counselor to reopen it.' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'not_started' AND NEW.status IN ('draft', 'in_review'))
    OR (OLD.status = 'draft' AND NEW.status = 'in_review')
    OR (OLD.status = 'revision' AND NEW.status = 'in_review')
    OR (OLD.status = 'final' AND NEW.status = 'submitted')
  ) THEN
    RAISE EXCEPTION 'Only your counselor can change this essay''s status that way.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS essays_student_rules ON essays;
CREATE TRIGGER essays_student_rules
  BEFORE UPDATE ON essays
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_essay_rules();

-- Task rules for students: they can tick off any of their tasks, but cannot
-- reassign tasks or edit the details of tasks their counselor created.
CREATE OR REPLACE FUNCTION public.enforce_student_task_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_consultant() OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Tasks cannot be reassigned.' USING ERRCODE = '42501';
  END IF;

  IF OLD.created_by IS DISTINCT FROM auth.uid() AND (
       NEW.title IS DISTINCT FROM OLD.title
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
  ) THEN
    RAISE EXCEPTION 'Only your counselor can edit tasks they assigned.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_student_rules ON tasks;
CREATE TRIGGER tasks_student_rules
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_task_rules();

DROP POLICY IF EXISTS "Students can update own tasks" ON tasks;
CREATE POLICY "Students can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);
