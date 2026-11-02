'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { Ambient, Button, Diamond, Field, Input } from '@/components/portal/ui/primitives';
import { IconArrowRight } from '@/components/portal/ui/icons';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Sign-in is not configured in this environment. Try the demo instead.');
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError(authError?.message ?? 'Could not sign in.');
      setLoading(false);
      return;
    }

    // Make sure the account has a portal profile before entering.
    const { error: profileError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (profileError) {
      await supabase.auth.signOut();
      setError('Your account is missing a portal profile. Contact your counselor.');
      setLoading(false);
      return;
    }

    router.push('/portal');
    router.refresh();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-portal-bg">
      <Ambient />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        {/* Left: brand statement */}
        <section className="hidden flex-col justify-between border-r border-portal-line px-14 py-12 lg:flex">
          <a href="/" className="font-serif text-2xl font-bold tracking-tight text-portal-text">
            DeltaX
          </a>

          <div className="animate-rise max-w-lg">
            <p className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-portal-accent-light">
              <Diamond size={7} /> Student Portal
            </p>
            <h1 className="font-serif text-5xl font-bold leading-[1.08] tracking-tight text-portal-text">
              Every essay, deadline, and decision in one place.
            </h1>
            <div className="mt-12 grid grid-cols-3 border-y border-portal-line-strong">
              {[
                ['01', 'Schools'],
                ['02', 'Essays'],
                ['03', 'Deadlines'],
              ].map(([n, label], i) => (
                <div key={n} className={`py-5 ${i > 0 ? 'border-l border-portal-line pl-5' : ''}`}>
                  <div className="font-mono text-xs text-portal-accent-light">{n}</div>
                  <div className="mt-1 font-serif text-lg text-portal-text">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-portal-dim">DeltaX College Consulting</p>
        </section>

        {/* Right: form */}
        <section className="flex items-center justify-center px-6 py-16">
          <div className="animate-rise w-full max-w-sm">
            <a href="/" className="mb-12 block font-serif text-2xl font-bold tracking-tight text-portal-text lg:hidden">
              DeltaX
            </a>

            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-portal-muted">Welcome back</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-portal-text">Sign in</h2>

            <form onSubmit={handleLogin} className="mt-10 space-y-5" noValidate>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                />
              </Field>

              {error && (
                <p role="alert" className="border-l-2 border-portal-red pl-3 text-sm text-portal-red">
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" disabled={loading} className="h-11 w-full">
                {loading ? 'Signing in...' : 'Sign in'}
                {!loading && <IconArrowRight size={16} />}
              </Button>
            </form>

            <div className="mt-10 border-t border-portal-line pt-6 text-sm text-portal-muted">
              <p>Accounts are created by your counselor.</p>
              <a
                href="/portal/demo"
                className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-portal-accent-light hover:text-portal-text"
              >
                Explore the demo portal <IconArrowRight size={13} />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
