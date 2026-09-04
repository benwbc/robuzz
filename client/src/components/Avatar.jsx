import { Link } from 'react-router-dom';
import { initialsFor } from '../utils';
import { mediaUrl } from '../api';

export default function Avatar({ user, size = 44, linkToProfile = true }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4), minWidth: size };

  const content = user?.avatarUrl ? (
    <div className="avatar" style={style}>
      <img src={mediaUrl(user.avatarUrl)} alt="" loading="lazy" decoding="async" />
    </div>
  ) : (
    <div className="avatar" style={{ ...style, background: user?.avatarColor || '#555' }}>
      {initialsFor(user?.displayName || user?.username)}
    </div>
  );

  if (linkToProfile && user?.username) {
    return (
      <Link to={`/u/${user.username}`} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    );
  }
  return content;
}
