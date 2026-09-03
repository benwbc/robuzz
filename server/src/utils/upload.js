import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

function makeStorage(subfolder) {
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

export function toPublicPath(file) {
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
