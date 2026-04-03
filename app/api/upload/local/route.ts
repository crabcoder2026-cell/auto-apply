import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getStorageDriver, saveUploadedFile } from '@/lib/storage';

const VALID_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Node.js does not define global `File` in all versions/contexts; `instanceof File` throws ReferenceError.
 * FormData file entries are Blob-like with optional `name` (undici).
 */
function getUploadedBlob(
  value: FormDataEntryValue | null
): { blob: Blob; fileName: string } | null {
  if (value === null || typeof value !== 'object') return null;
  const o = value as Blob & { name?: string };
  if (typeof o.arrayBuffer !== 'function') return null;
  if (typeof o.size !== 'number') return null;
  const fileName =
    typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'resume';
  return { blob: o, fileName };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (getStorageDriver() !== 'local') {
      return NextResponse.json(
        { error: 'Local upload is disabled; storage is not in local mode.' },
        { status: 400 }
      );
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const uploaded = getUploadedBlob(formData.get('file'));
    if (!uploaded) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const { blob, fileName } = uploaded;

    if (!VALID_TYPES.has(blob.type)) {
      return NextResponse.json(
        { error: 'Only PDF or Word documents are allowed' },
        { status: 400 }
      );
    }

    if (blob.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const cloud_storage_path = saveUploadedFile(userId, buffer, fileName);

    return NextResponse.json({
      cloud_storage_path,
      resumeFileName: fileName,
    });
  } catch (error: unknown) {
    console.error('Local upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
