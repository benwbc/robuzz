import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import UserRow from '../components/UserRow';
import PostCard from '../components/PostCard';
import Icon from '../components/Icon';

import { api } from '../api';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const [results, setResults] = useState({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput(q);
  }, [q]);

  useEffect(() => {
    if (!q.trim()) {
      setResults({ users: [], posts: [] });
      return;
    }
    setLoading(true);
    api
      .search(q)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  };

  return (
    <div>
      <div className="main-header">
        <form onSubmit={submit} style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }}>
            <Icon name="search" size={18} />
          </span>
          <input
            type="search"
            placeholder="Search BlockFeed"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </form>
      </div>

      {loading && <div className="spinner-wrap">Searching…</div>}

      {!loading && q && results.users.length === 0 && results.posts.length === 0 && (
        <div className="empty-state">
          <h3>No results for "{q}"</h3>
        </div>
      )}

      {!loading && !q && (
        <div className="empty-state">
          <h3>Search BlockFeed</h3>
          <p>Find people, #hashtags, or anything in a post.</p>
        </div>
      )}

      {results.users.length > 0 && (
        <div>
          <h3 style={{ padding: '14px 16px 4px', margin: 0, fontSize: 16 }}>People</h3>
          {results.users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      )}

      {results.posts.length > 0 && (
        <div>
          <h3 style={{ padding: '14px 16px 4px', margin: 0, fontSize: 16 }}>Posts</h3>
          {results.posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
