import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import DiscordButton from '../components/DiscordButton';
import Icon from '../components/Icon';
import { sanitizeUsername } from '../utils';

// Reachable while already signed in (see the route comment in App.jsx) —
// login/signup here go through the exact same AuthContext methods as the
// normal pages, which append this account to the switcher (or just switch
// to it, if it's already one of the signed-in ones) instead of replacing
// whatever's currently active.
export default function AddAccount() {
  const { login, signup, accounts, maxAccounts } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [signupForm, setSignupForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const atCap = accounts.length >= maxAccounts;
  const setSignupField = (k) => (e) => setSignupForm((f) => ({ ...f, [k]: e.target.value }));

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signup(signupForm);
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
        <p style={{ color: 'var(--text-secondary)', marginTop: -8 }}>
          {mode === 'login' ? 'Add another account' : 'Create another account'}
        </p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: -8 }}>
          You're signed into {accounts.length} of {maxAccounts} accounts on this device.
        </p>

        {atCap && (
          <div className="alert alert-warning">
            You've reached the {maxAccounts}-account limit — log one out (from the account switcher) before adding
            another.
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        {!atCap && mode === 'login' && (
          <form onSubmit={submitLogin}>
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
        )}

        {!atCap && mode === 'signup' && (
          <form onSubmit={submitSignup}>
            <div className="field">
              <label>Display name</label>
              <input type="text" value={signupForm.displayName} onChange={setSignupField('displayName')} maxLength={40} required autoFocus />
            </div>
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                value={signupForm.username}
                onChange={(e) => setSignupForm((f) => ({ ...f, username: sanitizeUsername(e.target.value) }))}
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20 characters: letters, numbers, underscore"
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={signupForm.email} onChange={setSignupField('email')} required />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput value={signupForm.password} onChange={setSignupField('password')} minLength={8} required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Sign up'}
            </button>
          </form>
        )}

        {!atCap && (
          <>
            <div className="auth-divider">or</div>
            <DiscordButton label="Continue with Discord" />
          </>
        )}

        {!atCap && (
          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                Don't have this account yet?{' '}
                <button type="button" className="link-button" onClick={() => { setMode('signup'); setError(''); }}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="link-button" onClick={() => { setMode('login'); setError(''); }}>
                  Log in
                </button>
              </>
            )}
          </div>
        )}

        <div className="auth-switch">
          <Link to="/">
            <Icon name="arrowLeft" size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Back to RoBuzz
          </Link>
        </div>
      </div>
    </div>
  );
}
