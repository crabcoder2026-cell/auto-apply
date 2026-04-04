import { NextResponse } from 'next/server';
import { refreshJobFeedCache } from '@/lib/job-feed-aggregator';

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
 * Refresh the shared Auto Search job cache (~30m schedule recommended).
 * curl -H "Authorization: Bearer $CRON_SECRET" "$NEXTAUTH_URL/api/cron/job-feed"
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

  try {
    const out = await refreshJobFeedCache();
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('cron job-feed:', e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
