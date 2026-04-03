import path from 'path';
import fs from 'fs';
import { getFileUrl as s3GetFileUrl } from './s3';

export type StorageDriver = 'local' | 's3';

export type ResumeForAutomation =
  | { kind: 'path'; path: string }
  | { kind: 'url'; url: string };

/**
 * STORAGE_DRIVER: "local" | "s3". If unset, uses S3 when AWS_BUCKET_NAME is set, else local.
 */
export function getStorageDriver(): StorageDriver {
  const d = process.env.STORAGE_DRIVER?.toLowerCase();
  if (d === 's3') return 's3';
  if (d === 'local') return 'local';
  return process.env.AWS_BUCKET_NAME ? 's3' : 'local';
}

const UPLOAD_PREFIX = 'uploads';

function isSafeLocalKey(key: string): boolean {
  if (!key.startsWith(`${UPLOAD_PREFIX}/`)) return false;
  if (key.includes('..') || path.isAbsolute(key)) return false;
  const normalized = path.normalize(key);
  return normalized.startsWith(UPLOAD_PREFIX + path.sep) || normalized === UPLOAD_PREFIX;
}

/**
 * Save an uploaded resume under uploads/<userId>/ and return the storage key (DB resumePath).
 */
export function saveUploadedFile(
  userId: string,
  buffer: Buffer,
  originalName: string
): string {
  const safe =
    originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'resume';
  const key = `${UPLOAD_PREFIX}/${userId}/${Date.now()}-${safe}`;
  const abs = path.join(process.cwd(), ...key.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return key;
}

export function resolveLocalAbsolutePath(key: string): string | null {
  if (!isSafeLocalKey(key)) return null;
  const abs = path.join(process.cwd(), ...key.split('/').filter(Boolean));
  if (!fs.existsSync(abs)) return null;
  return abs;
}

/**
 * For Puppeteer: local files use filesystem path; S3 uses a time-limited signed URL.
 */
export async function getResumeForAutomation(
  resumePath: string | null
): Promise<ResumeForAutomation | null> {
  if (!resumePath) return null;

  if (getStorageDriver() === 'local') {
    const abs = resolveLocalAbsolutePath(resumePath);
    if (!abs) return null;
    return { kind: 'path', path: abs };
  }

  const url = await s3GetFileUrl(resumePath, false);
  return { kind: 'url', url };
}
