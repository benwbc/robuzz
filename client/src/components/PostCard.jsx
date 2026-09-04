import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import Icon from './Icon';
import RichText from './RichText';
import ReportModal from './ReportModal';
import ImageLightbox from './ImageLightbox';
import { NameWithBadge } from './BadgeIcon';
import { useAuth } from '../context/AuthContext';
import { api, mediaUrl } from '../api';
import { timeAgo } from '../utils';

export default function PostCard({ post, onRemoved }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRepost = !!post.repostedPost;
  const reposter = isRepost ? post.author : null;

  const [target, setTarget] = useState(isRepost ? post.repostedPost : post);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    setTarget(isRepost ? post.repostedPost : post);
  }, [post, isRepost]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  if (gone) return null;

  if (isRepost && (!target || target.removed)) {
    return (
      <div className="post">
        <div className="post-body">
          <div className="post-repost-of">
            <Icon name="repost" size={14} /> <NameWithBadge user={reposter} /> reposted
          </div>
          <div className="deleted-note">This post is no longer available.</div>
        </div>
      </div>
    );
  }
  if (!target) return null;

  const mine = user && target.authorId === user.id;
  const wrapperMine = user && post.authorId === user.id;
  const canModerate = user && ['moderator', 'admin'].includes(user.role);

  const goToPost = () => navigate(`/post/${target.id}`);

  const doLike = async (e) => {
    e.stopPropagation();
    if (!user) return navigate('/login');
    try {
      const res = target.likedByMe ? await api.unlike(target.id) : await api.like(target.id);
      setTarget((t) => ({ ...t, likedByMe: res.likedByMe, likeCount: res.likeCount }));
    } catch (err) {
      alert(err.message);
    }
  };

  const doRepost = async (e) => {
    e.stopPropagation();
    if (!user) return navigate('/login');
    try {
      const res = await api.repost(target.id);
      setTarget((t) => ({ ...t, repostedByMe: res.reposted, repostCount: res.repostCount }));
      setMenuOpen(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const doDelete = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const reason = canModerate && !mine ? prompt('Reason for removing this post (shown in the audit log):') || '' : undefined;
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.deletePost(target.id, reason);
      setGone(true);
      onRemoved?.(target.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const doRemoveRepost = async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      await api.repost(target.id);
      setGone(true);
      onRemoved?.(post.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const imgCount = target.images?.length || 0;

  return (
    <div className="post" onClick={goToPost}>
      <Avatar user={target.author} />
      <div className="post-body">
        {isRepost && (
          <div className="post-repost-of">
            <Icon name="repost" size={14} /> <NameWithBadge user={reposter} /> reposted
          </div>
        )}
        <div className="post-header">
          <span className="name">
            <NameWithBadge user={target.author} />
          </span>
          <span className="handle">@{target.author?.username}</span>
          <span className="dot">·</span>
          <span className="time">{timeAgo(target.createdAt)}</span>

          <div className="post-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)}>
              <Icon name="dots" size={16} />
            </button>
            {menuOpen && (
              <div className="post-menu">
                {wrapperMine && (
                  <button onClick={doRemoveRepost}>
                    <Icon name="repost" size={15} style={{ marginRight: 8, verticalAlign: -3 }} /> Remove repost
                  </button>
                )}
                {(mine || canModerate) && (
                  <button className="danger" onClick={doDelete}>
                    <Icon name="trash" size={15} style={{ marginRight: 8, verticalAlign: -3 }} />
                    {mine ? 'Delete post' : 'Remove post (staff)'}
                  </button>
                )}
                {!mine && user && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      setReportOpen(true);
                    }}
                  >
                    <Icon name="flag" size={15} style={{ marginRight: 8, verticalAlign: -3 }} /> Report post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {target.flagged && (mine || canModerate) && (
          <div className="post-flag-banner">⚠ Auto-flagged for review{target.flagReason ? `: ${target.flagReason}` : ''}</div>
        )}

        {target.text && (
          <div className="post-text">
            <RichText text={target.text} />
          </div>
        )}

        {imgCount > 0 && (
          <div className={`post-images n${Math.min(imgCount, 4)}`}>
            {target.images.slice(0, 4).map((src, i) => (
              <img
                key={i}
                src={mediaUrl(src)}
                alt=""
                loading="lazy"
                decoding="async"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex(i);
                }}
              />
            ))}
          </div>
        )}

        <div className="post-actions">
          <button className="post-action" onClick={(e) => { e.stopPropagation(); goToPost(); }}>
            <Icon name="comment" size={17} /> {target.commentCount || ''}
          </button>
          <button className={`post-action ${target.repostedByMe ? 'reposted' : ''}`} onClick={doRepost}>
            <Icon name="repost" size={17} /> {target.repostCount || ''}
          </button>
          <button className={`post-action ${target.likedByMe ? 'liked' : ''}`} onClick={doLike}>
            <Icon name="heart" size={17} filled={target.likedByMe} /> {target.likeCount || ''}
          </button>
          <button
            className="post-action"
            onClick={(e) => {
              e.stopPropagation();
              setReportOpen(true);
            }}
          >
            <Icon name="flag" size={16} />
          </button>
        </div>
      </div>

      {reportOpen && <ReportModal targetType="post" targetId={target.id} targetLabel="post" onClose={() => setReportOpen(false)} />}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={target.images}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
