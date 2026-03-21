import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { email, password, fullName, assignedConsultantId } = await request.json();

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Create profile
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    role: 'student',
    full_name: fullName,
    email,
    avatar_initials: initials,
    assigned_consultant_id: assignedConsultantId || null,
  });

  if (profileError) {
    return NextResponse.json({ error: 'User created but profile failed: ' + profileError.message }, { status: 500 });
  }

  // Create a conversation between student and assigned consultant
  if (assignedConsultantId) {
    await supabaseAdmin.from('conversations').insert({
      student_id: authData.user.id,
      consultant_id: assignedConsultantId,
    });
  }

  return NextResponse.json({ success: true, userId: authData.user.id });
}
