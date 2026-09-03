import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import RichText from '../components/RichText';
import { NameWithBadge } from '../components/BadgeIcon';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { timeAgo } from '../utils';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    api
      .getPost(id)
      .then((d) => {
        setPost(d.post);
        setComments(d.comments);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const submitComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const { comment } = await api.addComment(id, text);
      setComments((c) => [...c, comment]);
      setText('');
      setPost((p) => (p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(commentId);
      setComments((c) => c.filter((x) => x.id !== commentId));
      setPost((p) => (p ? { ...p, commentCount: Math.max(0, (p.commentCount || 1) - 1) } : p));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="spinner-wrap">Loading…</div>;
  if (error || !post) {
    return (
      <div className="empty-state">
        <h3>Post not found</h3>
        <p>{error || 'It may have been removed.'}</p>
      </div>
    );
  }

  const canModerate = user && ['moderator', 'admin'].includes(user.role);

  return (
    <div>
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <button className="icon-btn" onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" />
        </button>
        <h1>Post</h1>
      </div>

      <PostCard post={post} onRemoved={() => navigate(-1)} />

      {user && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <form onSubmit={submitComment} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Avatar user={user} size={36} />
            <input
              type="text"
              placeholder="Post your reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={300}
            />
            <button className="btn btn-primary btn-sm" disabled={submitting || !text.trim()}>
              Reply
            </button>
          </form>
        </div>
      )}

      {comments.map((c) => (
        <div className="post" key={c.id} style={{ cursor: 'default' }}>
          <Avatar user={c.author} size={40} />
          <div className="post-body">
            <div className="post-header">
              <span className="name">
                <NameWithBadge user={c.author} />
              </span>
              <span className="handle">@{c.author?.username}</span>
              <span className="dot">·</span>
              <span className="time">{timeAgo(c.createdAt)}</span>
              {(user?.id === c.authorId || canModerate) && (
                <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => deleteComment(c.id)}>
                  <Icon name="trash" size={15} />
                </button>
              )}
            </div>
            <div className="post-text">
              <RichText text={c.text} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
