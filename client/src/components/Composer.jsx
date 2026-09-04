import { useRef, useState } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import MentionTextarea from './MentionTextarea';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const MAX_LEN = 500;
const MAX_IMAGES = 4;

export default function Composer({ onPosted, autoFocus = false, placeholder = "What's happening in Roblox?" }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!user) return null;

  const addFiles = (fileList) => {
    const files = Array.from(fileList).slice(0, MAX_IMAGES - images.length);
    const next = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES));
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!text.trim() && images.length === 0) return;
    setPosting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('text', text);
      images.forEach((img) => fd.append('images', img.file));
      const { post } = await api.createPost(fd);
      setText('');
      setImages([]);
      onPosted?.(post);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  const remaining = MAX_LEN - text.length;

  return (
    <div className="composer">
      <Avatar user={user} size={44} />
      <div className="composer-body">
        {error && <div className="alert alert-error">{error}</div>}
        <MentionTextarea
          as="textarea"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          maxLength={MAX_LEN + 50}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        {images.length > 0 && (
          <div className="composer-images">
            {images.map((img, i) => (
              <div className="composer-image-preview" key={i}>
                <img src={img.url} alt="" />
                <button className="composer-image-remove" type="button" onClick={() => removeImage(i)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-footer">
          <div className="composer-tools">
            <button
              className="icon-btn"
              type="button"
              disabled={images.length >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
              title="Add image"
            >
              <Icon name="image" size={20} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={`char-count ${remaining < 0 ? 'over' : remaining < 40 ? 'warn' : ''}`}>{remaining}</span>
            <button
              className="btn btn-primary"
              disabled={posting || remaining < 0 || (!text.trim() && images.length === 0)}
              onClick={submit}
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
