import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { api } from '../api';
import { timeAgo } from '../utils';

const STATUS_PILL = { open: 'pending', resolved: 'actioned' };

export default function Support() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'new' | ticket id

  const load = () => {
    setLoading(true);
    api
      .myTickets()
      .then((d) => setTickets(d.tickets))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (view === 'new') {
    return (
      <NewTicket
        onCreated={(ticket) => {
          load();
          setView(ticket.id);
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view !== 'list') {
    return (
      <TicketThread
        id={view}
        onBack={() => {
          setView('list');
          load();
        }}
      />
    );
  }

  return (
    <div>
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Support</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setView('new')}>
          New ticket
        </button>
      </div>

      {loading ? (
        <div className="spinner-wrap">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <h3>No tickets yet</h3>
          <p>Having a problem or a question? Open a ticket and staff will reply here.</p>
        </div>
      ) : (
        tickets.map((t) => (
          <div key={t.id} className="notif-item" onClick={() => setView(t.id)} style={{ cursor: 'pointer' }}>
            <div className="notif-icon support">
              <Icon name="help" size={16} filled />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</b>
                <span className={`pill pill-status-${STATUS_PILL[t.status]}`}>{t.status}</span>
              </div>
              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.lastMessage?.message} · {timeAgo(t.updatedAt)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function NewTicket({ onCreated, onCancel }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { ticket } = await api.createTicket({ subject, message });
      onCreated(ticket);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="main-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Back">
          <Icon name="arrowLeft" size={18} />
        </button>
        <h1>New ticket</h1>
      </div>
      <form onSubmit={submit} style={{ padding: 16 }}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label>Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={100} required autoFocus />
        </div>
        <div className="field">
          <label>What's going on?</label>
          <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>
    </div>
  );
}

function TicketThread({ id, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = () => {
    api
      .getTicket(id)
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
      const d = await api.replyTicket(id, reply.trim());
      setTicket(d.ticket);
      setMessages(d.messages);
      setReply('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
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
        </div>
        <span className={`pill pill-status-${STATUS_PILL[ticket.status]}`}>{ticket.status}</span>
      </div>

      <div className="ticket-thread">
        {messages.map((m) => (
          <div key={m.id} className={`ticket-message${m.isStaff ? ' staff' : ''}`}>
            <div className="ticket-message-meta">
              <b>{m.isStaff ? 'Staff' : m.author?.displayName || 'You'}</b>
              <span>· {timeAgo(m.createdAt)}</span>
            </div>
            <div className="ticket-message-body">{m.message}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="ticket-reply-bar" onSubmit={send}>
        <textarea
          rows={1}
          placeholder={ticket.status === 'resolved' ? 'Replying will reopen this ticket…' : 'Write a reply…'}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          maxLength={2000}
        />
        <button className="btn btn-primary" type="submit" disabled={sending || !reply.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
