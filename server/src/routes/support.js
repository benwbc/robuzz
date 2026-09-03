import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireActive } from '../middleware/roles.js';
import { toTicketDTO, toTicketMessageDTO, toPublicUser } from '../utils/serialize.js';

const router = Router();
const MAX_SUBJECT_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 2000;

router.use(requireAuth, requireActive);

async function loadThread(ticketId) {
  const messages = await db.all('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId]);
  const authorIds = [...new Set(messages.map((m) => m.author_id))];
  const authors = {};
  for (const id of authorIds) {
    authors[id] = toPublicUser(await db.get('SELECT * FROM users WHERE id = ?', [id]));
  }
  return messages.map((m) => ({ ...toTicketMessageDTO(m), author: authors[m.author_id] || null }));
}

// ---- My tickets ----
router.get('/tickets', async (req, res) => {
  const rows = await db.all('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
  const tickets = await Promise.all(
    rows.map(async (t) => {
      const last = await db.get('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1', [t.id]);
      return { ...toTicketDTO(t), lastMessage: last ? toTicketMessageDTO(last) : null };
    })
  );
  res.json({ tickets });
});

router.post('/tickets', async (req, res) => {
  const subject = String((req.body || {}).subject || '').trim();
  const message = String((req.body || {}).message || '').trim();
  if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
    return res.status(400).json({ error: `Subject must be 1-${MAX_SUBJECT_LENGTH} characters.` });
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be 1-${MAX_MESSAGE_LENGTH} characters.` });
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  await db.run('INSERT INTO support_tickets (id, user_id, subject, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    req.user.id,
    subject,
    'open',
    now,
    now,
  ]);
  await db.run(
    'INSERT INTO support_messages (id, ticket_id, author_id, is_staff, message, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    [randomUUID(), id, req.user.id, message, now]
  );

  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [id]);
  res.status(201).json({ ticket: toTicketDTO(ticket), messages: await loadThread(id) });
});

router.get('/tickets/:id', async (req, res) => {
  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket || ticket.user_id !== req.user.id) return res.status(404).json({ error: 'Ticket not found.' });
  res.json({ ticket: toTicketDTO(ticket), messages: await loadThread(ticket.id) });
});

router.post('/tickets/:id/messages', async (req, res) => {
  const ticket = await db.get('SELECT * FROM support_tickets WHERE id = ?', [req.params.id]);
  if (!ticket || ticket.user_id !== req.user.id) return res.status(404).json({ error: 'Ticket not found.' });

  const message = String((req.body || {}).message || '').trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be 1-${MAX_MESSAGE_LENGTH} characters.` });
  }

  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO support_messages (id, ticket_id, author_id, is_staff, message, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    [randomUUID(), ticket.id, req.user.id, message, now]
  );
  // A reply from the user brings a resolved ticket back to staff's attention.
  const newStatus = ticket.status === 'resolved' ? 'open' : ticket.status;
  await db.run('UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, ticket.id]);

  const updated = await db.get('SELECT * FROM support_tickets WHERE id = ?', [ticket.id]);
  res.json({ ticket: toTicketDTO(updated), messages: await loadThread(ticket.id) });
});

export default router;
