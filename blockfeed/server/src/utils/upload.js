import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

// Local disk storage (the only mode until now) works great on your own
// computer, but most free hosts reset their filesystem on every
// restart/redeploy — anything saved to disk there disappears. Given a
// Supabase project's URL + service key, uploaded images go to Supabase
// Storage instead, which is free, persistent, and gives back a normal
// public https:// URL. Nothing changes for local dev unless these env vars
// are set.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'blockfeed-uploads';

export const usingCloudStorage = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const supabase = usingCloudStorage ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

function makeStorage(subfolder) {
  if (usingCloudStorage) {
    // Buffer in memory; fileUrl() below pushes the buffer up to Supabase
    // Storage right after multer finishes parsing the upload.
    return multer.memoryStorage();
  }
  const dir = path.join(uploadsRoot, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext || ''}`);
    },
  });
}

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed.'));
  }
  cb(null, true);
};

export const uploadPostImages = multer({
  storage: makeStorage('posts'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
});

export const uploadProfileImage = multer({
  storage: makeStorage('profile'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Turns an uploaded file into a URL the browser can load, regardless of
// which storage engine is active. `subfolder` groups files the same way
// makeStorage() does ('posts' / 'profile') so cloud storage keeps the same
// shape as the old local-disk layout.
export async function fileUrl(file, subfolder) {
  if (!file) return null;

  if (usingCloudStorage) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const key = `${subfolder}/${randomUUID()}${ext || ''}`;
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw new Error(`Image upload failed: ${error.message}`);
    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(key);
    return data.publicUrl;
  }

  const rel = path.relative(uploadsRoot, file.path).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

export function pagination(req, { defaultLimit = 20, maxLimit = 50 } = {}) {
  let limit = parseInt(req.query.limit, 10);
  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (!Number.isFinite(page) || page <= 0) page = 1;
  return { limit, offset: (page - 1) * limit };
}
