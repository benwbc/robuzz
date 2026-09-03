import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/Avatar';
import Icon from '../../components/Icon';
import { api } from '../../api';
import { timeAgo } from '../../utils';

const STATUS_PILL = { open: 'pending', resolved: 'actioned' };

export default function Tickets() {
  const [status, setStatus] = useState('open');
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .adminTickets(status === 'all' ? undefined : status)
      .then((d) => {
        setTickets(d.tickets);
        setOpenCount(d.openCount);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [status]);

  if (selected) {
    return (
      <AdminTicketThread
        id={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <div>
      <div className="admin-search-bar">
        {['open', 'resolved', 'all'].map((s) => (
          <button key={s} className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatus(s)}>
            {s === 'open' ? `Open (${openCount})` : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <h3>All clear</h3>
          <p>No {status === 'all' ? '' : status} tickets right now.</p>
        </div>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="notif-item" onClick={() => setSelected(t.id)} style={{ cursor: 'pointer' }}>
            <Avatar user={t.user} size={36} linkToProfile={false} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</b>
                <span className={`pill pill-status-${STATUS_PILL[t.status]}`}>{t.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                @{t.user?.username} · {timeAgo(t.updatedAt)}
              </div>
              <div
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 13,
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.lastMessage?.message}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AdminTicketThread({ id, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    api
      .adminGetTicket(id)
      .then((d) => {
        setTicket(d.ticket);
        setMessages(d.messages);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const d = await api.adminReplyTicket(id, reply.trim());
      setTicket(d.ticket);
      setMessages(d.messages);
      setReply('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    try {
      const { ticket: updated } = await api.adminSetTicketStatus(id, status);
      setTicket(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="spinner-wrap">Loading…</div>;
  if (!ticket) return <div className="empty-state">Ticket not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} aria-label="Back">
          <Icon name="arrowLeft" size={18} />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</h1>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <Link to={`/u/${ticket.user?.username}`}>@{ticket.user?.username}</Link>
          </div>
        </div>
        {ticket.status === 'open' ? (
          <button className="btn btn-sm btn-secondary" onClick={() => setStatus('resolved')}>
            Mark resolved
          </button>
        ) : (
          <button className="btn btn-sm btn-secondary" onClick={() => setStatus('open')}>
            Reopen
          </button>
        )}
      </div>

      <div className="ticket-thread">
        {messages.map((m) => (
          <div key={m.id} className={`ticket-message${m.isStaff ? ' staff' : ''}`}>
            <div className="ticket-message-meta">
              <b>{m.isStaff ? 'Staff' : `@${m.author?.username}`}</b>
              <span>· {timeAgo(m.createdAt)}</span>
            </div>
            <div className="ticket-message-body">{m.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="ticket-reply-bar" onSubmit={send}>
        <textarea rows={1} placeholder="Reply as staff…" value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} />
        <button className="btn btn-primary" type="submit" disabled={sending || !reply.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
