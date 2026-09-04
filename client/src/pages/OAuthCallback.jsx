import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { OAUTH_STATE_KEY } from '../api';

// Lands here after the round trip through Discord (see server/src/routes/auth.js's
// /discord and /discord/callback). The server never talks to our client code
// directly — it can only hand control back via a browser redirect — so this
// page's whole job is to pick up what that redirect carried (a token, or an
// error) and either finish signing in or explain what went wrong.
export default function OAuthCallback() {
  const [params] = useSearchParams();
  const { completeOAuth } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // effects can fire twice in dev — this redirect must only be consumed once
    ran.current = true;

    const token = params.get('token');
    const returnedState = params.get('state') || '';
    const serverError = params.get('error');

    let expectedState = '';
    try {
      expectedState = sessionStorage.getItem(OAUTH_STATE_KEY) || '';
      sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
      /* ignore */
    }

    if (serverError) {
      setError(serverError);
      return;
    }
    if (!token) {
      setError("Discord didn't send back a sign-in token.");
      return;
    }
    // expectedState is only blank when sessionStorage failed at the start of
    // the trip (see DiscordButton) — in that case there's nothing to check
    // against, so let it through rather than blocking a real sign-in over a
    // storage hiccup that wasn't Discord's fault.
    if (expectedState && returnedState !== expectedState) {
      setError("This sign-in link is stale or wasn't started from this browser. Please try again.");
      return;
    }

    completeOAuth(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err) => setError(err.message || "Couldn't complete Discord sign-in."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>
          <img className="logo-mark" src="/logo.png" alt="" /> RoBuzz
        </h1>
        {error ? (
          <>
            <div className="alert alert-error">{error}</div>
            <div className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </div>
          </>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Finishing Discord sign-in…</p>
        )}
      </div>
    </div>
  );
}
