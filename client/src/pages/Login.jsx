import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import DiscordButton from '../components/DiscordButton';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [suspendedInfo, setSuspendedInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuspendedInfo(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      if (err.data?.status === 'suspended' || err.data?.status === 'banned') {
        setSuspendedInfo(err.data);
      } else {
        setError(err.message);
      }
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
        <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>Log in to your account</p>

        {error && <div className="alert alert-error">{error}</div>}
        {suspendedInfo && (
          <div className={`alert ${suspendedInfo.status === 'banned' ? 'alert-error' : 'alert-warning'}`}>
            {suspendedInfo.error}
            {suspendedInfo.reason ? ` Reason: ${suspendedInfo.reason}` : ''}
            {suspendedInfo.suspendedUntil ? ` Until ${new Date(suspendedInfo.suspendedUntil).toLocaleString()}.` : ''}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="field">
            <label>Username or email</label>
            <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="auth-divider">or</div>
        <DiscordButton />

        <div className="auth-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
