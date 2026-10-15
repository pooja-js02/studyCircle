import { useRef, useState } from 'react';
import { Icon } from '../components/Icon.jsx';
import { Avatar, ErrorNote, Field } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';

// FR-AUTH-08: view and edit name, avatar and mobile (mobile needs the password)
export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name);
  const [mobile, setMobile] = useState(user.mobile.replace(/^\+91/, ''));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mobileChanged = `+91${mobile.replace(/\s/g, '')}` !== user.mobile;

  async function save(e) {
    e.preventDefault();
    setErrors({});
    setError('');
    const next = {};
    if (name.trim().length < 2) next.name = 'Enter your full name.';
    if (mobileChanged && !/^[6-9]\d{9}$/.test(mobile.replace(/\s/g, ''))) next.mobile = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    if (mobileChanged && !password) next.currentPassword = 'Enter your current password to change your mobile number.';
    if (Object.keys(next).length) return setErrors(next);
    setSaving(true);
    try {
      const body = { name: name.trim() };
      if (mobileChanged) Object.assign(body, { mobile: mobile.replace(/\s/g, ''), currentPassword: password });
      const res = await api.patch('/me', body);
      setUser(res.user);
      setPassword('');
      toast('Profile saved.', { tone: 'success' });
    } catch (err) {
      if (err.field) setErrors({ [err.field]: err.message });
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('Avatars can be at most 2 MB.', { tone: 'error' });
    setUploading(true);
    try {
      const data = new FormData();
      data.append('avatar', f);
      setUser((await api.upload('/me/avatar', data)).user);
      toast('Avatar updated.', { tone: 'success' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    try {
      setUser((await api.patch('/me', { removeAvatar: true })).user);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-4xl font-bold">Your profile</h1>
      {user.isDemo && (
        <p className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          You’re using a shared demo account. Some actions, like changing the mobile number or deleting groups, are turned off.
        </p>
      )}
      <section className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar user={user} size={84} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary">
              <Icon name="image" size={17} /> {uploading ? 'Uploading…' : 'Change avatar'}
            </button>
            {user.avatar && (
              <button type="button" onClick={removeAvatar} className="btn-ghost">
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={uploadAvatar} aria-label="Upload avatar" />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-muted">PNG or JPG, up to 2 MB. Everyone in your groups sees your name and avatar.</p>
      </section>

      <form onSubmit={save} className="glass space-y-4 rounded-3xl p-6" noValidate>
        <Field label="Full name" error={errors.name}>
          {(p) => <input {...p} className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Gmail address" hint="Used to log in. Never shown to other users.">
          {(p) => <input {...p} className="input bg-slate-50 text-ink-muted" value={user.email} readOnly />}
        </Field>
        <Field label="Mobile number" error={errors.mobile} hint="Used only for account recovery. Visible only to you and platform administrators.">
          {(p) => (
            <div className="solid flex items-center rounded-2xl focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
              <span className="border-r border-slate-200 px-4 py-3 text-sm font-semibold text-ink-soft">+91</span>
              <input {...p} type="tel" inputMode="numeric" maxLength={11} className="w-full bg-transparent px-4 py-3 text-sm outline-none" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          )}
        </Field>
        {mobileChanged && (
          <Field label="Current password" error={errors.currentPassword} hint="Needed to change your mobile number.">
            {(p) => <input {...p} type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        )}
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <button type="button" onClick={() => logout()} className="btn-ghost">
            <Icon name="logout" size={17} /> Log out
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
