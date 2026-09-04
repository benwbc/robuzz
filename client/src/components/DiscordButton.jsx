import { discordAuthUrl, OAUTH_STATE_KEY } from '../api';

// A plain, text-only button rather than a Discord logo mark — Discord's
// "Clyde" icon is a trademarked brand asset, so this sticks to their
// official button color instead of trying to redraw it.
export default function DiscordButton({ label = 'Continue with Discord' }) {
  const go = () => {
    // A random nonce, stashed for OAuthCallback to check on the way back —
    // proves the redirect we eventually act on started from this browser
    // just now, not from a stale or forged link.
    const state = crypto.randomUUID();
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
    } catch {
      /* ignore (private browsing, storage full, etc.) — state will just fail
         to match on return, which fails safely into a "try again" error */
    }
    window.location.href = discordAuthUrl(state);
  };

  return (
    <button type="button" className="btn btn-discord btn-block" onClick={go}>
      {label}
    </button>
  );
}
