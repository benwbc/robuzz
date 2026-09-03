import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import BadgeIcon from '../../components/BadgeIcon';
import { MODERATION_ACTIONS, REPORT_REASONS } from '../../constants';
import { api } from '../../api';
import { timeAgo } from '../../utils';

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));

export default function Reports() {
  const [status, setStatus] = useState('pending');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const load = () => {
    setLoading(true);
    api
      .adminReports(status === 'all' ? undefined : status)
      .then((d) => {
        setReports(d.reports);
        setPendingCount(d.pendingCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  const handleResolved = (id, updated) => {
    setReports((rs) => (status === 'all' ? rs.map((r) => (r.id === id ? { ...r, ...updated } : r)) : rs.filter((r) => r.id !== id)));
    setPendingCount((c) => Math.max(0, c - 1));
  };

  return (
    <div>
      <div className="admin-search-bar">
        {['pending', 'actioned', 'dismissed', 'all'].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus(s)}>
            {s === 'pending' ? `Pending (${pendingCount})` : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <h3>All clear</h3>
          <p>No {status === 'all' ? '' : status} reports right now.</p>
        </div>
      ) : (
        reports.map((r) => <ReportCard key={r.id} report={r} onResolved={(u) => handleResolved(r.id, u)} />)
      )}
    </div>
  );
}

function ReportCard({ report, onResolved }) {
  const [action, setAction] = useState('dismiss');
  const [note, setNote] = useState('');
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    setBusy(true);
    try {
      const { report: updated } = await api.resolveReport(report.id, { action, note, durationDays: Number(days) });
      onResolved(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const availableActions = MODERATION_ACTIONS.filter((a) => {
    if (a.value === 'delete_post') return report.targetType === 'post';
    if (a.value === 'delete_comment') return report.targetType === 'comment';
    if (a.value === 'unban_user') return report.target?.status === 'banned' || report.target?.status === 'suspended';
    return true;
  });

  return (
    <div className="report-card">
      <div className="report-meta">
        <span className="pill pill-reason">{REASON_LABEL[report.reason] || report.reason}</span>
        <span className={`pill pill-status-${report.status}`}>{report.status}</span>
        <span>· {timeAgo(report.createdAt)}</span>
        <span>· reported by {report.reporter ? `@${report.reporter.username}` : 'automated system'}</span>
      </div>
      {report.details && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>"{report.details}"</div>}

      <div className="report-target-preview">
        <ReportTarget target={report.target} targetType={report.targetType} />
      </div>

      {report.status !== 'pending' && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Resolution note: {report.resolutionNote || '(none)'}</div>
      )}

      {report.status === 'pending' && (
        <div className="report-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={action} onChange={(e) => setAction(e.target.value)} style={{ maxWidth: 240 }}>
              {availableActions.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            {action === 'suspend_user' && (
              <input
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                style={{ width: 90 }}
                title="Days"
              />
            )}
          </div>
          <input
            type="text"
            placeholder="Note — goes in the audit log, and to the user for account actions"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={resolve} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      )}
    </div>
  );
}

function ReportTarget({ target, targetType }) {
  if (!target) return <div style={{ color: 'var(--text-tertiary)' }}>The reported {targetType} no longer exists.</div>;

  if (target.kind === 'post') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Avatar user={target.author} size={24} linkToProfile={false} />
          <Link to={`/u/${target.author?.username}`} style={{ fontWeight: 700, fontSize: 13 }}>
            @{target.author?.username}
          </Link>
          <BadgeIcon badge={target.author?.badge} size={13} />
          {target.deleted && <span className="pill pill-status-dismissed">already removed</span>}
        </div>
        {target.text && <div style={{ fontSize: 14 }}>{target.text}</div>}
        {target.images?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            {target.images.map((src, i) => (
              <img key={i} src={src} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        )}
        <Link to={`/post/${target.id}`} style={{ fontSize: 12, color: 'var(--link)', display: 'inline-block', marginTop: 6 }}>
          View post →
        </Link>
      </div>
    );
  }

  if (target.kind === 'comment') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Avatar user={target.author} size={24} linkToProfile={false} />
          <Link to={`/u/${target.author?.username}`} style={{ fontWeight: 700, fontSize: 13 }}>
            @{target.author?.username}
          </Link>
          {target.deleted && <span className="pill pill-status-dismissed">already removed</span>}
        </div>
        <div style={{ fontSize: 14 }}>{target.text}</div>
        <Link to={`/post/${target.postId}`} style={{ fontSize: 12, color: 'var(--link)', display: 'inline-block', marginTop: 6 }}>
          View thread →
        </Link>
      </div>
    );
  }

  if (target.kind === 'user') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar user={target} size={32} linkToProfile={false} />
        <div>
          <Link to={`/u/${target.username}`} style={{ fontWeight: 700 }}>
            @{target.username}
          </Link>{' '}
          <BadgeIcon badge={target.badge} size={13} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>current status: {target.status}</div>
        </div>
      </div>
    );
  }

  return null;
}
