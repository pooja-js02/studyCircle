import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound({ title = 'Page not found', message = 'The page you’re looking for doesn’t exist or has moved.' }) {
  return (
    <section className="glass rounded-3xl">
      <EmptyState icon="compass" title={title} action={<Link to="/discover" className="btn-primary mt-2">Discover groups</Link>}>
        {message}
      </EmptyState>
    </section>
  );
}
