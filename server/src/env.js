import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

// First run convenience: generate a local .env with a random JWT secret
// so the app works out of the box. Replace this for any real deployment.
if (!fs.existsSync(envPath)) {
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(
    envPath,
    `PORT=3001\nJWT_SECRET=${secret}\nCLIENT_ORIGIN=http://localhost:5173\n`
  );
  console.log('[env] generated server/.env with a new random JWT_SECRET');
}

dotenv.config({ path: envPath });
