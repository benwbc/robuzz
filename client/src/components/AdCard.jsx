import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { api, mediaUrl } from '../api';

// Rendered inline in the feed, styled like a post so it keeps the same
// visual rhythm as everything around it — the "Sponsored" label is what
// discloses it's an ad, matching how real ad platforms do this rather than
// disguising it as an organic post.
export default function AdCard({ ad }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    api.trackAdImpression(ad.id).catch(() => {});
  }, [ad.id]);

  const openAd = () => {
    api.trackAdClick(ad.id).catch(() => {});
    if (ad.linkUrl) window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`post ad-card${ad.linkUrl ? ' clickable' : ''}`} onClick={ad.linkUrl ? openAd : undefined}>
      <div className="ad-card-icon">
        <Icon name="megaphone" size={20} />
      </div>
      <div className="post-body">
        <div className="post-header">
          <span className="ad-card-sponsored">Sponsored</span>
        </div>
        {ad.label && <div className="post-text">{ad.label}</div>}
        <div className="post-images n1">
          <img src={mediaUrl(ad.imageUrl)} alt={ad.label || 'Advertisement'} loading="lazy" decoding="async" />
        </div>
      </div>
    </div>
  );
}
