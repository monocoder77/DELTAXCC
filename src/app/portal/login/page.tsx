'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password.');
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Get profile to verify role
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (profile) {
        localStorage.setItem('portal_auth', 'live');
        localStorage.setItem('portal_role', profile.role);
      }
    }

    router.push('/portal');
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a2e] via-[#2d1b4e] to-[#1a0a2e] flex items-center justify-center px-4 font-[family-name:var(--font-libre)]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block text-3xl font-bold text-portal-accent tracking-tight">
            DeltaX
          </a>
          <p className="text-portal-muted mt-2">Portal Login</p>
        </div>

        {/* Login Card */}
        <div className="border-2 border-portal-border rounded-lg p-8">
          <h1 className="text-xl font-semibold text-portal-text mb-6">
            Sign In
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
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
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <p className="text-portal-rose text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-medium py-3 rounded-lg transition-colors disabled:opacity-50 text-white bg-portal-accent hover:bg-portal-accent/90"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-portal-dim text-sm mt-6">
          Contact your counselor for account access.
        </p>
      </div>
    </div>
  );
}
