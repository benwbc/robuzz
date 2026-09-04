import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import DiscordButton from '../components/DiscordButton';
import { sanitizeUsername } from '../utils';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signup(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>
          <img className="logo-mark" src="/logo.png" alt="" /> RoBuzz
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>Create your account</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Display name</label>
            <input type="text" value={form.displayName} onChange={set('displayName')} maxLength={40} required autoFocus />
          </div>
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: sanitizeUsername(e.target.value) }))}
              pattern="[a-zA-Z0-9_]{3,20}"
              title="3-20 characters: letters, numbers, underscore"
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label>Password</label>
            <PasswordInput value={form.password} onChange={set('password')} minLength={8} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <div className="auth-divider">or</div>
        <DiscordButton label="Sign up with Discord" />

        <div className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
        <div className="auth-disclaimer">
          By signing up, you agree to RoBuzz's <Link to="/rules">Terms &amp; Community Rules</Link>.
        </div>
        <div className="auth-disclaimer">
          RoBuzz is a fan-made, independent community platform for Roblox players and creators. It is not
          affiliated with or endorsed by Roblox Corporation.
        </div>
      </div>
    </div>
  );
}
