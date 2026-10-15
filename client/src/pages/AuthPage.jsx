import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Icon } from '../components/Icon.jsx';
import { Avatar, Blobs, ErrorNote, Field, Logo } from '../components/ui.jsx';

const DEMO = { email: 'demo.ananya@gmail.com', password: 'studycircle' };

function validate(mode, f) {
  const errors = {};
  if (mode === 'signup') {
    if (f.name.trim().length < 2) errors.name = 'Enter your full name.';
    if (!/^[a-z0-9.+_-]+@gmail\.com$/i.test(f.email.trim())) errors.email = 'Use a Gmail address (name@gmail.com).';
    if (!/^[6-9]\d{9}$/.test(f.mobile.replace(/\s/g, ''))) errors.mobile = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    if (f.password.length < 8) errors.password = 'Use at least 8 characters.';
  } else {
    if (!f.email.trim()) errors.email = 'Enter your email.';
    if (!f.password) errors.password = 'Enter your password.';
  }
  return errors;
}

export default function AuthPage({ mode }) {
  const { login, register, sessionMessage } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isSignup = mode === 'signup';
  const keepNext = location.search;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (err.field) setErrors((x) => ({ ...x, [err.field]: err.message }));
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const v = validate(mode, form);
    setErrors(v);
    if (Object.keys(v).length) return;
    run(() => (isSignup ? register({ ...form, mobile: form.mobile.replace(/\s/g, '') }) : login(form.email, form.password)));
  }

  return (
    <div className="relative min-h-dvh">
      <Blobs />
      <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <section className="hidden lg:block">
          <Logo size={44} />
          <h1 className="mt-10 text-6xl font-bold leading-[1.02]">
            Study together.
            <br />
            <span className="text-brand-600">Stay in the circle.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Private groups for your batch. Shared notes, live chat with @mentions, and admins who decide who gets in.
          </p>
          <div className="glass mt-10 inline-flex items-center gap-4 rounded-3xl px-5 py-4">
            <span className="flex -space-x-2">
              {['Priya Sharma', 'Rahul Verma', 'Aman Gill'].map((n) => (
                <Avatar key={n} user={{ name: n }} size={40} className="ring-2 ring-white" />
              ))}
            </span>
            <span>
              <span className="block font-semibold">JEE Physics ’26</span>
              <span className="flex items-center gap-1.5 text-sm text-ink-muted">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> studying right now
              </span>
            </span>
          </div>
        </section>

        <section className="glass mx-auto w-full max-w-md rounded-4xl p-6 sm:p-8">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-3xl font-bold">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {isSignup ? 'Already have one? ' : 'New to StudyCircle? '}
            <Link to={`${isSignup ? '/login' : '/signup'}${keepNext}`} className="font-semibold">
              {isSignup ? 'Log in' : 'Create an account'}
            </Link>
          </p>

          {sessionMessage && !isSignup && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{sessionMessage}</p>
          )}

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {isSignup && (
              <Field label="Full name" error={errors.name}>
                {(p) => <input {...p} className="input" autoComplete="name" value={form.name} onChange={set('name')} />}
              </Field>
            )}
            <Field label={isSignup ? 'Gmail address' : 'Email'} error={errors.email}>
              {(p) => <input {...p} type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} placeholder="name@gmail.com" />}
            </Field>
            {isSignup && (
              <Field
                label="Mobile number"
                error={errors.mobile}
                hint="Your mobile number is used only for account recovery and is visible only to platform administrators — never to group members."
              >
                {(p) => (
                  <div className="solid flex items-center rounded-2xl focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
                    <span className="border-r border-slate-200 px-4 py-3 text-sm font-semibold text-ink-soft">+91</span>
                    <input {...p} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={11} className="w-full bg-transparent px-4 py-3 text-sm outline-none" value={form.mobile} onChange={set('mobile')} placeholder="98765 43210" />
                  </div>
                )}
              </Field>
            )}
            <Field label="Password" error={errors.password} hint={isSignup ? 'At least 8 characters.' : undefined}>
              {(p) => <input {...p} type="password" className="input" autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} />}
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <button type="submit" disabled={busy} className="btn-primary w-full text-base">
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
            <p className="text-sm font-semibold text-brand-900">Just looking around?</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">Log in as Ananya, the admin of a demo group with chat, notes and join requests waiting.</p>
            <button type="button" disabled={busy} onClick={() => run(() => login(DEMO.email, DEMO.password))} className="btn-secondary mt-3 w-full">
              <Icon name="sparkle" size={18} className="text-brand-600" /> Try the demo account
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
