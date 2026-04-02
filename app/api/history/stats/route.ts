import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const [total, success, failed, manual] = await Promise.all([
      prisma.applicationHistory.count({ where: { userId } }),
      prisma.applicationHistory.count({ where: { userId, status: 'success' } }),
      prisma.applicationHistory.count({ where: { userId, status: 'failed' } }),
      prisma.applicationHistory.count({ where: { userId, status: 'requires_manual' } }),
    ]);

    return NextResponse.json({
      stats: {
        total,
        success,
        failed,
        manual,
      },
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
