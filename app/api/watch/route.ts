import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getWatchConfig, upsertWatchConfig } from '@/lib/json-store';
import { getPresetBoardById } from '@/lib/preset-boards';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cfg = await getWatchConfig(userId);
    const { appliedJobKeys, ...rest } = cfg;
    return NextResponse.json(
      {
        ...rest,
        appliedJobKeysCount: appliedJobKeys.length,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: unknown) {
    console.error('GET /api/watch:', e);
    return NextResponse.json(
      { error: 'Failed to load Auto pilot settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const selectedRaw = body.selectedBoardIds;
    const selectedBoardIds: string[] = Array.isArray(selectedRaw)
      ? selectedRaw.filter(
          (id: unknown): id is string =>
            typeof id === 'string' && Boolean(getPresetBoardById(id))
        )
      : [];

    const row = await upsertWatchConfig(userId, {
      enabled: Boolean(body.enabled),
      selectedBoardIds,
      keywords: typeof body.keywords === 'string' ? body.keywords : '',
      location: typeof body.location === 'string' ? body.location : '',
      department: typeof body.department === 'string' ? body.department : '',
    });

    const { appliedJobKeys, ...rest } = row;
    return NextResponse.json(
      {
        ...rest,
        appliedJobKeysCount: appliedJobKeys.length,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: unknown) {
    console.error('POST /api/watch:', e);
    return NextResponse.json(
      { error: 'Failed to save Auto pilot settings' },
      { status: 500 }
    );
  }
}
