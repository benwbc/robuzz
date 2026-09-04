import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';

const LAST_UPDATED = 'September 2026';

export default function Rules() {
  const navigate = useNavigate();

  return (
    <div className="auth-page" style={{ alignItems: 'flex-start', padding: '40px 20px' }}>
      <div className="auth-card legal-card">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
          Back
        </button>

        <h1 style={{ marginBottom: 0 }}>
          <img className="logo-mark" src="/logo.png" alt="" /> RoBuzz
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: -6 }}>Terms of Service &amp; Community Rules</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Last updated {LAST_UPDATED}</p>

        <div className="alert alert-info">
          RoBuzz is a fan-made, independent community platform for Roblox players and creators. It is not
          affiliated with, sponsored by, or endorsed by Roblox Corporation. "Roblox" and related marks belong to
          Roblox Corporation.
        </div>

        <section className="legal-section">
          <h2>Community Rules</h2>
          <p>
            These are the rules our moderation team enforces across posts, replies, profiles, and images. Breaking
            them can get content removed and, depending on severity, your account warned, suspended, or banned.
          </p>

          <h3>1. Be respectful</h3>
          <p>
            No harassment, bullying, hate speech, or targeted abuse of another person or group. Disagreements
            happen — attacking people over them isn't allowed.
          </p>

          <h3>2. No scams or fraud</h3>
          <p>
            Don't post or link to Robux/item scams, phishing pages, fake giveaways, or "free item generator" style
            content. Don't impersonate Roblox, RoBuzz staff, or another real person or account — badges (Verified,
            Staff, Official, Content Creator) are granted by our team and can't be faked.
          </p>

          <h3>3. Keep it appropriate</h3>
          <p>
            RoBuzz is used by a broad age range, similar to Roblox itself. Sexual content, graphic violence, and
            anything that sexualizes or endangers minors is never allowed and is reported to the relevant
            authorities where required by law. Posted text and images are automatically scanned and can be
            auto-flagged for our moderators to review.
          </p>

          <h3>4. No spam</h3>
          <p>
            Don't flood the feed with repetitive posts, unrelated self-promotion, or bulk-follow/bulk-comment
            behavior aimed at gaming engagement.
          </p>

          <h3>5. Respect intellectual property</h3>
          <p>
            Only post images and content you own or have permission to share. We respond to legitimate takedown
            requests for content that infringes someone else's rights.
          </p>

          <h3>6. Report, don't retaliate</h3>
          <p>
            Every post, comment, and profile has a Report option. Reports go to our moderation queue and are never
            shared with the person you reported. Please use reports instead of escalating a conflict yourself.
          </p>

          <h3>7. Enforcement</h3>
          <p>
            Depending on what happened, our moderators may remove content, add an account warning, temporarily
            suspend an account, or permanently ban it. Every moderation action is logged internally. Suspended or
            banned accounts can reach us through Support to ask about a decision.
          </p>
        </section>

        <section className="legal-section">
          <h2>Terms of Service</h2>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            RoBuzz is an independent, fan-run project rather than a large company with a dedicated legal team, so
            these terms are written in plain language on purpose. By creating an account, you agree to them.
          </p>

          <h3>Your account</h3>
          <p>
            You're responsible for your account and whatever is posted from it, including through any additional
            accounts you sign into using the account switcher. You need to provide a real, working email address
            and pick a password you keep private. If your account is old enough to have been created before a
            given feature shipped, newer rules still apply going forward.
          </p>

          <h3>Your content</h3>
          <p>
            You keep ownership of the text and images you post. By posting, you give RoBuzz permission to store,
            display, and distribute that content on the platform (for example, in feeds, search, and profile
            pages) for as long as your post or account exists. You can delete your own posts and comments at any
            time, which removes them from public view.
          </p>

          <h3>Uploaded images</h3>
          <p>
            Images you upload (posts, avatars, banners) are automatically resized and compressed so the app stays
            fast — the file you see displayed may not be pixel-identical to the original you uploaded. Don't upload
            images you don't have the right to share.
          </p>

          <h3>Roblox account linking</h3>
          <p>
            Linking a Roblox username looks up publicly available information from Roblox's own services to show
            your Roblox avatar and name on your RoBuzz profile. It does not verify that you own that Roblox
            account and is not "Sign in with Roblox" — anyone can type any public Roblox username. Don't link an
            account you don't own to impersonate someone else.
          </p>

          <h3>Advertising</h3>
          <p>
            RoBuzz may show sponsored posts, clearly labeled "Sponsored", from advertisers or from RoBuzz itself.
            Ads are shown alongside regular posts but are not endorsements by the people or accounts who happen to
            appear near them, and clicking one takes you to a third-party site RoBuzz doesn't control.
          </p>

          <h3>Suspension &amp; termination</h3>
          <p>
            We can remove content or suspend/ban an account that breaks the Community Rules above, at our
            discretion, with or without advance notice for serious violations. You can also stop using RoBuzz and
            ask us to close your account at any time through Support.
          </p>

          <h3>No warranty</h3>
          <p>
            RoBuzz is provided "as is," run as a fan project on a free hosting tier, without guarantees of
            uptime, data retention, or fitness for any particular purpose. Back up anything you'd be upset to
            lose.
          </p>

          <h3>Changes to these terms</h3>
          <p>
            We may update these terms or the Community Rules as the app changes. The "Last updated" date at the
            top will change when we do, and continuing to use RoBuzz after an update means you accept the revised
            terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>Privacy, in brief</h2>
          <p>
            We store what the app needs to work: your account details (email, username, display name, password —
            stored as a one-way hash, never in plain text), the content you post, images you upload, and, if you
            choose to link one, your public Roblox username. We don't sell your data to advertisers or other
            third parties. Signing in on multiple devices/accounts is handled entirely in your own browser's local
            storage, not shared with anyone else. Questions about your data can be sent through Support.
          </p>
        </section>

        <div className="auth-switch">
          Questions about any of this? <Link to="/support">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
