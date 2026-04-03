import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getStorageDriver } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ driver: getStorageDriver() });
  } catch (error: any) {
    console.error('Upload settings error:', error);
    return NextResponse.json(
      { error: 'Failed to read storage settings' },
      { status: 500 }
    );
  }
}
