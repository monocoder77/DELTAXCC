'use client';

/* ==========================================================================
   Settings
   Shared by students and counselors. Profile name, password, session and
   account details, laid out as ruled rows: a label column on the left and
   the controls on the right. Nothing here pretends to work when it cannot.
   ========================================================================== */

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage, useAccountActions, useMe, useProfile } from '@/lib/hooks';
import type { Profile } from '@/types/database';
import { Avatar, Button, Diamond, Field, Input, LoadingBlock, Panel, PanelHeader, Spinner, cx, formatDate, toneColor } from './ui/primitives';
import { IconCheck, IconLogout } from './ui/icons';

/** Same rule the account hook uses when it saves, so the preview matches the result. */
function initialsFor(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

function FeedbackLine({ feedback, children }: { feedback: Feedback; children?: ReactNode }) {
  if (!feedback) return null;
  if (feedback.kind === 'error') {
    return (
      <p role="alert" className="text-sm text-portal-red">
        {feedback.text}
      </p>
    );
  }
  return (
    <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-portal-green">
      <IconCheck size={14} />
      <span>{feedback.text}</span>
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Row layout: label column + content column, split by a hairline
   -------------------------------------------------------------------------- */
function SettingsRow({ index, title, description, children }: { index: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-portal-line py-10 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-portal-accent-light">{index}</p>
        <h2 className="font-serif text-xl font-bold text-portal-text">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-portal-muted">{description}</p>
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Profile
   -------------------------------------------------------------------------- */
function ProfileSection({ me }: { me: Profile }) {
  const { updateProfile } = useAccountActions();
  const [name, setName] = useState(me.full_name);
  const [savedName, setSavedName] = useState(me.full_name);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const trimmed = name.trim();
  const dirty = trimmed !== savedName.trim();
  const preview = initialsFor(trimmed) || me.avatar_initials;
  const isStudent = me.role === 'student';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trimmed) {
      setFeedback({ kind: 'error', text: 'Please enter your name.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateProfile(me.id, trimmed);
      setSavedName(updated.full_name || trimmed);
      setName(updated.full_name || trimmed);
      setFeedback({ kind: 'ok', text: 'Saved. Some parts of the portal may show your old name until you reload.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsRow index="01" title="Profile" description="How your name appears to your counselor and across the portal.">
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <div className="flex items-center gap-5">
          {/* square avatar framed by corner ticks */}
          <span className="relative p-2">
            <span aria-hidden="true" className="absolute left-0 top-0 h-2 w-2 border-l border-t border-portal-accent-light/60" />
            <span aria-hidden="true" className="absolute right-0 top-0 h-2 w-2 border-r border-t border-portal-accent-light/60" />
            <span aria-hidden="true" className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-portal-accent-light/60" />
            <span aria-hidden="true" className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-portal-accent-light/60" />
            <Avatar initials={preview} size={72} tone="accent" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl font-bold text-portal-text">{trimmed || 'Your name'}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
              {dirty ? 'Preview, not saved yet' : isStudent ? 'Student' : 'Counselor'}
            </p>
          </div>
        </div>

        <Field label="Full name" htmlFor="settings-name" error={!trimmed && name.length > 0 ? 'Your name cannot be blank.' : undefined}>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (feedback) setFeedback(null);
            }}
            autoComplete="name"
            maxLength={120}
            disabled={saving}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="settings-email"
          hint={
            isStudent
              ? 'Email changes go through DeltaX. Message your counselor if yours needs to change.'
              : 'Email changes go through DeltaX. Contact the DeltaX team if yours needs to change.'
          }
        >
          <Input id="settings-email" type="email" value={me.email} readOnly aria-readonly="true" className="cursor-default text-portal-muted" />
        </Field>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" disabled={saving || !dirty || !trimmed}>
            {saving ? 'Saving...' : 'Save profile'}
          </Button>
          {dirty && !saving && (
            <Button
              variant="ghost"
              onClick={() => {
                setName(savedName);
                setFeedback(null);
              }}
            >
              Discard
            </Button>
          )}
        </div>
        <FeedbackLine feedback={feedback}>
          {feedback?.kind === 'ok' && (
            <button type="button" onClick={() => window.location.reload()} className="text-portal-text underline underline-offset-4 hover:text-portal-accent-light">
              Reload now
            </button>
          )}
        </FeedbackLine>
      </form>
    </SettingsRow>
  );
}

/* --------------------------------------------------------------------------
   Password
   -------------------------------------------------------------------------- */
function Requirement({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li className={cx('flex items-center gap-2.5 transition-colors duration-200', met ? 'text-portal-green' : 'text-portal-dim')}>
      <Diamond size={7} filled={met} color={met ? toneColor.green : 'var(--color-portal-dim)'} />
      <span>{children}</span>
      <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
    </li>
  );
}

function PasswordSection() {
  const { updatePassword } = useAccountActions();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!longEnough) {
      setFeedback({ kind: 'error', text: 'Use at least 8 characters.' });
      return;
    }
    if (!matches) {
      setFeedback({ kind: 'error', text: 'The two passwords do not match.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirm('');
      setFeedback({ kind: 'ok', text: 'Password updated. Use it the next time you sign in.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const clearFeedback = () => {
    if (feedback) setFeedback(null);
  };

  return (
    <SettingsRow index="02" title="Password" description="Choose a new password for signing in. You will stay signed in on this device.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" htmlFor="settings-password">
            <Input
              id="settings-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFeedback();
              }}
              disabled={saving}
            />
          </Field>
          <Field label="Confirm password" htmlFor="settings-password-confirm">
            <Input
              id="settings-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                clearFeedback();
              }}
              disabled={saving}
            />
          </Field>
        </div>

        <ul className="space-y-1.5 font-mono text-[11px] uppercase tracking-[0.12em]" aria-label="Password requirements">
          <Requirement met={longEnough}>At least 8 characters</Requirement>
          <Requirement met={matches}>Both fields match</Requirement>
        </ul>

        <Button type="submit" variant="outline" disabled={saving || !password || !confirm}>
          {saving ? 'Updating...' : 'Update password'}
        </Button>
        <FeedbackLine feedback={feedback} />
      </form>
    </SettingsRow>
  );
}

/* --------------------------------------------------------------------------
   Session
   -------------------------------------------------------------------------- */
function SessionSection() {
  const { signOut, isDemo } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setPending(true);
    setError(null);
    try {
      await signOut();
      window.location.assign('/portal/login');
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <SettingsRow
      index="03"
      title="Session"
      description={isDemo ? 'This is the demo portal. Signing out takes you back to the login page.' : 'Sign out of the portal on this device.'}
    >
      <div className="space-y-3">
        <Button variant="danger" onClick={() => void onSignOut()} disabled={pending}>
          <IconLogout size={16} />
          {pending ? 'Signing out...' : 'Sign out'}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-portal-red">
            {error}
          </p>
        )}
      </div>
    </SettingsRow>
  );
}

/* --------------------------------------------------------------------------
   Account details
   -------------------------------------------------------------------------- */
function CounselorName({ id }: { id: string | null }) {
  const { profile, loading, error } = useProfile(id);
  if (!id) return <span className="text-portal-muted">Not assigned yet</span>;
  if (loading) return <Spinner label="Loading" />;
  if (error || !profile) return <span className="text-portal-muted">Your DeltaX counselor</span>;
  return <span>{profile.full_name}</span>;
}

function AccountSection({ me }: { me: Profile }) {
  const isStudent = me.role === 'student';
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Role', value: isStudent ? 'Student' : 'Counselor' },
    { label: 'Member since', value: formatDate(me.created_at, { month: 'long', day: 'numeric', year: 'numeric' }) },
  ];
  if (isStudent) rows.push({ label: 'Counselor', value: <CounselorName id={me.assigned_consultant_id} /> });

  return (
    <SettingsRow index="04" title="Account" description="Details DeltaX keeps on file for you.">
      <dl className="border-t border-portal-line">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-4 border-b border-portal-line py-3.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{row.label}</dt>
            <dd className="min-w-0 truncate text-sm text-portal-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsRow>
  );
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function SettingsPanel() {
  const me = useMe();
  const { loading } = useAuth();

  return (
    <Panel>
      <PanelHeader index="08" eyebrow="Settings" title="Your account" description="Update your name and password, or sign out." />
      {!me && loading ? (
        <LoadingBlock label="Loading your account" />
      ) : !me ? (
        <div role="alert" className="flex flex-wrap items-center gap-4 border-t border-portal-line py-8 text-sm text-portal-red">
          <span>We could not load your account details.</span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      ) : (
        <div className="stagger border-b border-portal-line">
          <ProfileSection key={me.id} me={me} />
          <PasswordSection />
          <SessionSection />
          <AccountSection me={me} />
        </div>
      )}
    </Panel>
  );
}
