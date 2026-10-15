import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import { Icon } from '../components/Icon.jsx';
import { PageLoader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useGroups } from '../context/GroupsContext.jsx';

// Opens the most recently active group, or welcomes a user with no groups yet
export default function Home() {
  const { user } = useAuth();
  const { groups, groupsLoaded } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  if (!groupsLoaded) return <PageLoader />;
  if (groups.length) return <Navigate to={`/g/${groups[0]._id}`} replace />;

  return (
    <section className="glass flex min-h-[calc(100dvh-32px)] flex-col items-center justify-center rounded-3xl px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-cta">
        <Icon name="users" size={30} />
      </span>
      <h1 className="mt-6 text-4xl font-bold">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="mt-3 max-w-md leading-relaxed text-ink-soft">
        Join a study group for your exam, or start your own and invite your batch. You can be in many groups at once.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/discover" className="btn-primary">
          <Icon name="compass" size={18} /> Discover groups
        </Link>
        <button type="button" onClick={() => setCreateOpen(true)} className="btn-secondary">
          <Icon name="plus" size={18} /> Create a group
        </button>
      </div>
      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(g) => navigate(`/g/${g._id}`)} />
    </section>
  );
}
