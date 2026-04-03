import { NextResponse } from 'next/server';
import { listEnabledWatchConfigs } from '@/lib/json-store';
import { runWatchForUser } from '@/lib/watch-runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  const bearer =
    auth?.replace(/^Bearer\s+/i, '').trim() ||
    new URL(request.url).searchParams.get('secret')?.trim();
  return bearer === secret;
}

/**
 * Call from an external scheduler every ~10 minutes, e.g.:
 * curl -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron/watch
 */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configs = await listEnabledWatchConfigs();
  const results: {
    userId: string;
    summary: string;
    totalAttempts: number;
    successCount: number;
    error?: string;
  }[] = [];

  for (const w of configs) {
    try {
      const out = await runWatchForUser(w.userId);
      results.push({
        userId: w.userId,
        summary: out.summary,
        totalAttempts: out.totalAttempts,
        successCount: out.successCount,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`cron watch user ${w.userId}:`, e);
      results.push({
        userId: w.userId,
        summary: 'Error',
        totalAttempts: 0,
        successCount: 0,
        error: msg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    ranForUsers: results.length,
    results,
  });
}
