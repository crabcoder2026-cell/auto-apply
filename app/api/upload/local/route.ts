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
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    if (!VALID_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF or Word documents are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cloud_storage_path = saveUploadedFile(userId, buffer, file.name);

    return NextResponse.json({
      cloud_storage_path,
      resumeFileName: file.name,
    });
  } catch (error: any) {
    console.error('Local upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
