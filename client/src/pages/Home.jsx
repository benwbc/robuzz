import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Composer from '../components/Composer';
import PostCard from '../components/PostCard';
import AdCard from '../components/AdCard';
import { api } from '../api';

// One sponsored slot for every this-many organic posts, cycling through
// whatever ads are currently active.
const AD_FREQUENCY = 5;

export default function Home() {
  const location = useLocation();
  const [tab, setTab] = useState('following');
  const [posts, setPosts] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (t) => {
    setLoading(true);
    setError('');
    try {
      const { posts } = await api.feed(t);
      setPosts(posts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  useEffect(() => {
    api.ads().then((d) => setAds(d.ads)).catch(() => {});
  }, []);

  const handlePosted = (post) => setPosts((p) => [post, ...p]);
  const handleRemoved = (id) => setPosts((p) => p.filter((x) => x.id !== id && x.repostedPost?.id !== id));

  return (
    <div>
      <div className="main-header">
        <h1>Home</h1>
        <div className="main-header-tabs">
          <div className={`main-header-tab ${tab === 'following' ? 'active' : ''}`} onClick={() => setTab('following')}>
            Following
          </div>
          <div className={`main-header-tab ${tab === 'foryou' ? 'active' : ''}`} onClick={() => setTab('foryou')}>
            For You
          </div>
        </div>
      </div>

      <Composer onPosted={handlePosted} autoFocus={!!location.state?.focusComposer} />

      {error && (
        <div className="alert alert-error" style={{ margin: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>{tab === 'following' ? 'Nothing here yet' : 'No posts yet'}</h3>
          <p>
            {tab === 'following'
              ? "Follow some accounts, or switch to “For You” to see what's happening."
              : 'Be the first to post something!'}
          </p>
        </div>
      ) : (
        posts.flatMap((post, i) => {
          const items = [<PostCard key={post.id} post={post} onRemoved={handleRemoved} />];
          if (ads.length > 0 && i % AD_FREQUENCY === AD_FREQUENCY - 1) {
            items.push(<AdCard key={`ad-${post.id}`} ad={ads[Math.floor(i / AD_FREQUENCY) % ads.length]} />);
          }
          return items;
        })
      )}
    </div>
  );
}
