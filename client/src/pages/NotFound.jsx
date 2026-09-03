import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty-state">
      <h3>Page not found</h3>
      <p>
        <Link to="/" style={{ color: 'var(--link)' }}>
          Go back home
        </Link>
      </p>
    </div>
  );
}
