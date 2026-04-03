import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { runWatchForUser } from '@/lib/watch-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const out = await runWatchForUser(userId);
    return NextResponse.json({
      success: true,
      summary: out.summary,
      totalAttempts: out.totalAttempts,
      successCount: out.successCount,
      newKeysCount: out.newKeys.length,
    });
  } catch (e: unknown) {
    console.error('POST /api/watch/run:', e);
    const msg = e instanceof Error ? e.message : 'Auto pilot run failed';
    return NextResponse.json(
      { error: 'Auto pilot run failed', details: msg },
      { status: 500 }
    );
  }
}
