import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Explore() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .explore()
      .then((d) => setPosts(d.posts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="main-header">
        <h1>Explore</h1>
      </div>
      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h3>No image posts yet</h3>
          <p>Posts with photos show up here, Instagram-grid style.</p>
        </div>
      ) : (
        <div className="explore-grid">
          {posts.map((p) => (
            <div key={p.id} className="explore-tile" onClick={() => navigate(`/post/${p.id}`)}>
              <img src={p.images[0]} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
