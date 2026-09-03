// If ADMIN_BOOTSTRAP_EMAIL is set (e.g. as a Render environment variable),
// the account with that email is automatically promoted to admin — at boot
// (if the account already exists) and immediately after it signs up
// (if it doesn't exist yet). This gives a fresh deployment a real admin
// account, tied to whichever email the owner chooses, without needing the
// destructive seed script (which wipes the database and fills it with demo
// content) just to get one admin.
//
// Safe to leave set permanently: once that account is already an admin,
// promoting it again is a no-op.
export const ADMIN_BOOTSTRAP_EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();

export async function promoteIfBootstrapAdmin(db, { id, email }) {
  if (!ADMIN_BOOTSTRAP_EMAIL || String(email).toLowerCase() !== ADMIN_BOOTSTRAP_EMAIL) return false;
  await db.run(
    "UPDATE users SET role = 'admin', badge = CASE WHEN badge = 'none' THEN 'staff' ELSE badge END WHERE id = ?",
    [id]
  );
  return true;
}
