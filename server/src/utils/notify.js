import { randomUUID } from 'node:crypto';
import { db } from '../db.js';

export function createNotification({ userId, type, actorId = null, postId = null, message }) {
  if (!userId || userId === actorId) return; // never notify yourself
  db.prepare(
    `INSERT INTO notifications (id, user_id, type, actor_id, post_id, message, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(randomUUID(), userId, type, actorId, postId, message, new Date().toISOString());
}
