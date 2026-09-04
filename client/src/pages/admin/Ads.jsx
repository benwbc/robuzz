import { useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function Ads() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  const load = () => {
    setLoading(true);
    api
      .adminAds()
      .then((d) => setAds(d.ads))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Choose an image to upload.');
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('label', label);
      fd.append('linkUrl', linkUrl);
      const { ad } = await api.createAd(fd);
      setAds((a) => [ad, ...a]);
      setLabel('');
      setLinkUrl('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (ad) => {
    try {
      const { ad: updated } = await api.updateAd(ad.id, { active: !ad.active });
      setAds((list) => list.map((a) => (a.id === ad.id ? updated : a)));
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = async (ad) => {
    if (!confirm('Delete this ad? This cannot be undone.')) return;
    try {
      await api.deleteAd(ad.id);
      setAds((list) => list.filter((a) => a.id !== ad.id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      {isAdmin ? (
        <form className="admin-ad-form" onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Ad image</label>
            <input ref={fileInput} type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <div className="field">
            <label>Caption (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder="A short line shown above the image"
            />
          </div>
          <div className="field">
            <label>Link (optional)</label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Add ad'}
          </button>
        </form>
      ) : (
        <div className="alert alert-info" style={{ margin: 16 }}>
          Only admins can add, pause, or remove ads. You can still see how the current ones are doing below.
        </div>
      )}

      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : ads.length === 0 ? (
        <div className="empty-state">
          <h3>No ads yet</h3>
          <p>{isAdmin ? "Upload one above — it'll start showing in the Home feed right away." : 'Nothing has been uploaded yet.'}</p>
        </div>
      ) : (
        <div className="admin-ad-list">
          {ads.map((ad) => (
            <div className="admin-ad-row" key={ad.id}>
              <img className="admin-ad-thumb" src={mediaUrl(ad.imageUrl)} alt="" />
              <div className="admin-ad-info">
                <div className="admin-ad-label">
                  {ad.label || <span style={{ color: 'var(--text-tertiary)' }}>No caption</span>}
                </div>
                {ad.linkUrl && (
                  <a className="admin-ad-link" href={ad.linkUrl} target="_blank" rel="noopener noreferrer">
                    {ad.linkUrl}
                  </a>
                )}
                <div className="admin-ad-stats">
                  {ad.impressions} shown · {ad.clicks} clicked
                </div>
              </div>
              <span className={`pill pill-status-${ad.active ? 'active' : 'suspended'}`}>
                {ad.active ? 'Active' : 'Paused'}
              </span>
              {isAdmin && (
                <>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleActive(ad)}>
                    {ad.active ? 'Pause' : 'Resume'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(ad)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
