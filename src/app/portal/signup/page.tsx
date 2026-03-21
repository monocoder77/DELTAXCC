'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const role = 'student';
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!fullName || !email || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Create profile
      const initials = fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        role,
        full_name: fullName,
        email,
        avatar_initials: initials,
      });

      if (profileError) {
        setError('Account created but profile setup failed: ' + profileError.message);
        setLoading(false);
        return;
      }

      // If email confirmation is disabled, go straight to portal
      if (authData.session) {
        localStorage.setItem('portal_auth', 'live');
        localStorage.setItem('portal_role', role);
        router.push('/portal');
      } else {
        setSuccess('Account created! Check your email to confirm, then sign in.');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] flex items-center justify-center px-4 font-[family-name:var(--font-libre)]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-block text-3xl font-bold text-portal-accent tracking-tight">
            DeltaX
          </a>
          <p className="text-portal-muted mt-2">Create Account</p>
        </div>

        <div className="border-2 border-portal-border rounded-lg p-8">
          <h1 className="text-xl font-semibold text-portal-text mb-6">
            Student Sign Up
          </h1>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm text-portal-muted mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-portal-bg border border-portal-border rounded-lg px-4 py-3 text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent transition-colors"
                placeholder="Alex Johnson"
              />
            </div>

            <div>
              <label className="block text-sm text-portal-muted mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-portal-bg border border-portal-border rounded-lg px-4 py-3 text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-portal-muted mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-portal-bg border border-portal-border rounded-lg px-4 py-3 text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            {error && <p className="text-portal-rose text-sm">{error}</p>}
            {success && <p className="text-portal-green text-sm">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-medium py-3 rounded-lg transition-colors disabled:opacity-50 text-white bg-portal-accent hover:bg-portal-accent/90"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-portal-dim text-sm mt-6">
            Already have an account?{' '}
            <a href="/portal/login" className="text-portal-accent hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
