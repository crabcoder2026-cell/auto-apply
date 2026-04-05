import { existsSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';

/**
 * Ensures .env.production is loaded in the Node server process.
 * Helps PM2 / systemd where the shell never sourced the file, and complements Next's own env loading.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const envPath = join(process.cwd(), '.env.production');
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}
