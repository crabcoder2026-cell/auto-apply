import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { countHistoryByUser } from '@/lib/json-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [total, success, failed, manual] = await Promise.all([
      countHistoryByUser(userId),
      countHistoryByUser(userId, 'success'),
      countHistoryByUser(userId, 'failed'),
      countHistoryByUser(userId, 'requires_manual'),
    ]);

    return NextResponse.json({
      stats: {
        total,
        success,
        failed,
        manual,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
