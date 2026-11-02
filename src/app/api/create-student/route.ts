import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  // Only signed-in counselors may create accounts. This route uses the
  // service role key, so it must never be callable anonymously.
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (caller?.role !== 'consultant') {
    return NextResponse.json({ error: 'Only counselors can create student accounts' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const { email, password, fullName } = body as Record<string, unknown>;
  // New students are always assigned to the counselor who creates them.
  const assignedConsultantId = user.id;

  if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' || !email || !password || !fullName.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Use service role client to create user without affecting current session
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create profile
  const initials = fullName
    .trim()
    .split(/\s+/)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    role: 'student',
    full_name: fullName.trim(),
    email: email.trim().toLowerCase(),
    avatar_initials: initials,
    assigned_consultant_id: assignedConsultantId,
  });

  if (profileError) {
    // Don't leave an auth user without a profile; it could sign in but not use the portal.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: 'Could not create the student profile: ' + profileError.message }, { status: 500 });
  }

  // Create a conversation between student and assigned counselor
  const { error: conversationError } = await supabaseAdmin.from('conversations').insert({
    student_id: authData.user.id,
    consultant_id: assignedConsultantId,
  });
  if (conversationError) {
    console.error('create-student: conversation insert failed', conversationError.message);
  }

  return NextResponse.json({ success: true, userId: authData.user.id });
}
