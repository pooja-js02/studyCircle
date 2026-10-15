import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';
import JoinButton from '../components/JoinButton.jsx';
import { EmptyState, ErrorNote, GroupAvatar, PrivacyBadge, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { EXAMS, plural } from '../lib/format.js';

function Rating({ group }) {
  if (!group.ratingCount) return <span className="text-ink-faint">New</span>;
  return (
    <span className="flex items-center gap-1 font-semibold text-ink">
      <span className="text-amber-500">★</span> {group.ratingAverage.toFixed(1)}
      <span className="font-normal text-ink-muted">· {plural(group.ratingCount, 'review')}</span>
    </span>
  );
}

function GroupCard({ group, onChange }) {
  return (
    <article className="glass card-hover flex flex-col gap-4 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <GroupAvatar name={group.name} size={52} rounded="rounded-2xl" />
        <PrivacyBadge privacy={group.privacy} />
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold leading-snug">{group.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">{group.description || 'No description yet.'}</p>
      </div>
      {group.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {group.tags.slice(0, 4).map((t) => (
            <li key={t} className="chip bg-white text-ink-soft">
              {t.length <= 5 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1)}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <Rating group={group} />
        <span>{plural(group.memberCount, 'member')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/g/${group._id}/preview`} className="btn-secondary btn-sm min-h-[44px]">
          Preview
        </Link>
        <JoinButton group={group} onChange={onChange} size="btn-sm min-h-[44px]" />
      </div>
    </article>
  );
}

// FR-GRP-08: search Open and Approval groups by name, tag or exam; filter by exam chips
export default function Discover() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const exam = params.get('exam') || '';
  const [query, setQuery] = useState(search);
  const [invite, setInvite] = useState('');
  const [data, setData] = useState({ groups: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (exam) qs.set('tags', exam.toLowerCase());
      setData(await api.get(`/groups?${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, exam]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Debounced search as you type
  useEffect(() => {
    const t = setTimeout(() => {
      if (query !== search) {
        const next = new URLSearchParams(params);
        if (query) next.set('q', query);
        else next.delete('q');
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, search, params, setParams]);

  const setExam = (x) => {
    const next = new URLSearchParams(params);
    if (x) next.set('exam', x);
    else next.delete('exam');
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-5">
      {user && (
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-1 rounded-xl text-sm font-medium">
          <Icon name="back" size={16} /> Back to my groups
        </Link>
      )}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Find your study circle</h1>
          <p className="mt-2 text-ink-muted">Public groups for every exam. Approval groups let the admin choose who joins.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const code = invite.trim().toUpperCase();
            if (code) navigate(`/join/${code}`);
          }}
          className="glass flex items-center gap-2 rounded-2xl p-1.5 pl-4"
        >
          <label htmlFor="invite" className="whitespace-nowrap text-sm font-semibold text-ink-soft">
            Have an invite code?
          </label>
          <input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} maxLength={6} placeholder="X7K2PQ" className="w-24 rounded-xl bg-white px-3 py-2 text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-200" />
          <button type="submit" className="btn-primary btn-sm min-h-[40px] shadow-none">
            Go
          </button>
        </form>
      </header>

      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-1.5">
        <Icon name="search" size={18} className="text-ink-faint" />
        <label htmlFor="group-search" className="sr-only">
          Search groups
        </label>
        <input id="group-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, subject or exam" className="min-h-[44px] w-full bg-transparent text-base outline-none placeholder:text-ink-faint" />
        {loading && <Spinner />}
      </div>

      <div role="group" aria-label="Filter by exam" className="flex flex-wrap gap-2">
        {['', ...EXAMS].map((x) => (
          <button
            key={x || 'all'}
            type="button"
            aria-pressed={exam === x}
            onClick={() => setExam(x)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition ${exam === x ? 'bg-brand-600 text-white shadow-cta' : 'solid text-ink-soft hover:bg-white'}`}
          >
            {x || 'All'}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!loading && !error && data.groups.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState icon="search" title="No groups found">
            Try another exam or a shorter search. Invite-only groups don’t appear here; ask for their code.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {data.groups.map((g) => (
            <GroupCard key={g._id} group={g} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
}
