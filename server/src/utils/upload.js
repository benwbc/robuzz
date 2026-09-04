import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { normalizeOrigin, normalizeSlug } from './normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

// Local disk storage (the only mode until now) works great on your own
// computer, but most free hosts reset their filesystem on every
// restart/redeploy — anything saved to disk there disappears. Given a
// Supabase project's URL + service key, uploaded images go to Supabase
// Storage instead, which is free, persistent, and gives back a normal
// public https:// URL. Nothing changes for local dev unless these env vars
// are set.
//
// SUPABASE_URL and SUPABASE_BUCKET are normalized (trimmed, and for the
// URL, reduced to just its origin) because a hand-pasted trailing slash or
// stray extra path segment on either one is exactly what produces
// Supabase's cryptic "Invalid path specified in request URL" upload error.
const SUPABASE_URL = normalizeOrigin(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const SUPABASE_BUCKET = normalizeSlug(process.env.SUPABASE_BUCKET) || 'blockfeed-uploads';

export const usingCloudStorage = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const supabase = usingCloudStorage ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

// A signed URL this far out is, for practical purposes, permanent — and
// unlike getPublicUrl(), it works whether or not the bucket was ever
// switched to "Public" in Supabase's dashboard (a very easy step to miss).
// It's created with the secret service key, which bypasses bucket
// permissions entirely, so images just work regardless of that setting.
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10;

// Check the bucket is actually reachable at boot, so a misconfiguration
// shows up clearly in the server's startup logs instead of as a generic
// "something went wrong" the first time someone tries to upload an image.
if (usingCloudStorage) {
  const { error: bucketError } = await supabase.storage.getBucket(SUPABASE_BUCKET);
  if (bucketError) {
    console.error(
      `Supabase Storage bucket "${SUPABASE_BUCKET}" at ${SUPABASE_URL} is not reachable (${bucketError.message}). ` +
        'Image uploads will fail until this is fixed. Check that SUPABASE_BUCKET exactly matches a bucket ' +
        'you created under Storage in Supabase, that SUPABASE_URL above is exactly your Supabase project\'s ' +
        '"Project URL" from Settings → API (nothing before or after it), and that SUPABASE_SERVICE_KEY is the ' +
        '"secret" key from Settings → API Keys (not the "anon"/"publishable" one).'
    );
  } else {
    console.log(`Supabase Storage bucket "${SUPABASE_BUCKET}" at ${SUPABASE_URL} is reachable.`);
  }
}

// Every upload is now resized and recompressed with sharp (see
// processImage below) before it's saved anywhere, so multer only ever
// needs to hand back the raw bytes in memory — never write the original,
// unprocessed file to disk. That's true for local disk storage too: what
// finally lands in uploads/ is always the already-shrunk version.
//
// The size limit is generous (12MB) precisely because it no longer
// reflects what gets stored — a modern phone photo can easily be
// 8-12MB, and it comes out the other end of processImage() at a few
// hundred KB regardless of how large it went in.
const fileFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed.'));
  }
  cb(null, true);
};

function memoryUpload(limits) {
  return multer({ storage: multer.memoryStorage(), fileFilter, limits });
}

export const uploadPostImages = memoryUpload({ fileSize: 12 * 1024 * 1024, files: 4 });
export const uploadProfileImage = memoryUpload({ fileSize: 12 * 1024 * 1024, files: 1 });
export const uploadAdImage = memoryUpload({ fileSize: 12 * 1024 * 1024, files: 1 });

// Bounding-box dimensions per image "kind" (the same string used as the
// storage subfolder). Every image is fit *inside* its box, keeping its
// aspect ratio and never upscaling a smaller original — this just caps
// how large a file the browser ever has to download and decode, so a
// tiny 44px avatar never quietly ships a 4000x3000 original.
const IMAGE_SPECS = {
  avatar: { width: 512, height: 512 },
  banner: { width: 1600, height: 500 },
  posts: { width: 1600, height: 1600 },
  ads: { width: 1600, height: 1600 },
};

async function processImage(buffer, kind) {
  const spec = IMAGE_SPECS[kind] || IMAGE_SPECS.posts;
  try {
    return await sharp(buffer)
      // .rotate() with no argument auto-orients using the image's EXIF
      // orientation tag, then strips EXIF entirely (which also drops any
      // embedded location data) — without this, photos taken on a phone
      // held sideways/upside-down would render sideways/upside-down.
      .rotate()
      .resize(spec.width, spec.height, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    // A mimetype of image/* only means the browser's upload dialog filtered
    // by extension — the bytes themselves can still be corrupt, truncated,
    // or a format libvips can't decode. Catch that here with a message
    // someone can actually act on, instead of a raw libvips error string.
    console.error('Image processing failed:', err);
    throw new Error("That image couldn't be processed — try a different photo or file format.");
  }
}

// Turns an uploaded file into a URL the browser can load, regardless of
// which storage engine is active. `kind` both groups files the way the
// old local-disk layout did ('posts' / 'avatar' / 'banner' / 'ads') and
// picks the resize box above.
export async function fileUrl(file, kind) {
  if (!file) return null;

  const processed = await processImage(file.buffer, kind);
  const filename = `${randomUUID()}.webp`;

  if (usingCloudStorage) {
    const key = `${kind}/${filename}`;
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(key, processed, {
      contentType: 'image/webp',
      upsert: false,
      // Filenames are random and never reused, so it's always safe to
      // tell browsers/CDNs to cache the file for a full year.
      cacheControl: '31536000',
    });
    if (error) throw new Error(`Image upload failed: ${error.message}`);

    const { data, error: signError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(key, SIGNED_URL_SECONDS);
    if (signError) throw new Error(`Could not create an image URL: ${signError.message}`);
    return data.signedUrl;
  }

  const dir = path.join(uploadsRoot, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), processed);
  return `/uploads/${kind}/${filename}`;
}

export function pagination(req, { defaultLimit = 20, maxLimit = 50 } = {}) {
  let limit = parseInt(req.query.limit, 10);
  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (!Number.isFinite(page) || page <= 0) page = 1;
  return { limit, offset: (page - 1) * limit };
}
