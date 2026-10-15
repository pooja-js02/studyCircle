import { useEffect, useId, useRef } from 'react';
import { assetUrl } from '../lib/api.js';
import { colorFor, initials, PRIVACY_LABEL } from '../lib/format.js';
import { Icon } from './Icon.jsx';

export function Logo({ size = 36, withText = true }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex items-center justify-center rounded-xl bg-brand-600" style={{ width: size, height: size }}>
        <svg aria-hidden="true" width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      {withText && <span className="font-display text-[22px] font-bold tracking-tight">StudyCircle</span>}
    </span>
  );
}

// Decorative blurred colour fields behind the glass panels
export function Blobs({ variant = 'default' }) {
  const sets = {
    default: [
      { w: 560, bg: '#BFDBFE', style: { top: -160, left: 160 } },
      { w: 480, bg: '#A7F3D0', style: { bottom: -160, right: 80 }, delay: '-6s' },
      { w: 380, bg: '#FDE68A', style: { top: '45%', left: '48%' }, delay: '-11s', opacity: 0.45 },
    ],
    warm: [
      { w: 620, bg: '#FED7AA', style: { top: -240, left: -100 }, opacity: 0.6 },
      { w: 500, bg: '#BFDBFE', style: { top: 300, right: -120 }, delay: '-7s' },
    ],
  };
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {sets[variant].map((b, i) => (
        <div
          key={i}
          className="absolute animate-drift rounded-full"
          style={{ width: b.w, height: b.w, background: b.bg, filter: 'blur(80px)', opacity: b.opacity ?? 0.75, animationDelay: b.delay, ...b.style }}
        />
      ))}
    </div>
  );
}

export function Avatar({ user, size = 40, className = '' }) {
  const [bg, fg] = colorFor(user?.name || '');
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (user?.avatar) {
    return <img src={assetUrl(user.avatar)} alt="" className={`shrink-0 rounded-full object-cover ${className}`} style={style} />;
  }
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-bold ${className}`} style={{ ...style, background: bg, color: fg }}>
      {initials(user?.name)}
    </span>
  );
}

export function GroupAvatar({ name, size = 38, rounded = 'rounded-xl', className = '' }) {
  const [bg, fg] = colorFor(name);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-bold ${rounded} ${className}`}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.max(12, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function PrivacyBadge({ privacy }) {
  const tone = {
    open: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    approval: 'bg-amber-50 text-amber-800 border border-amber-200',
    invite: 'bg-violet-50 text-violet-800 border border-violet-200',
  }[privacy];
  return <span className={`chip ${tone}`}>{PRIVACY_LABEL[privacy]}</span>;
}

export function Spinner({ label = 'Loading', className = '' }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-ink-muted ${className}`}>
      <svg aria-hidden="true" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Field({ label, error, hint, children, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`w-[calc(100%-32px)] ${width} rounded-3xl border border-white/90 bg-white/95 p-0 text-ink shadow-glass backdrop:bg-slate-900/30 backdrop:backdrop-blur-sm`}
    >
      {open && (
        <div className="animate-pop p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-xl p-2 text-ink-muted hover:bg-slate-100">
              <Icon name="x" size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function EmptyState({ icon = 'sparkle', title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {children}
    </p>
  );
}
