import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { AUTO_SEARCH_PAGE_SIZE } from '@/lib/auto-search-config';
import type { CachedJobRow } from '@/lib/json-store';
import { getJobFeedCacheSync } from '@/lib/json-store';

export const dynamic = 'force-dynamic';

function filterJobs(
  jobs: CachedJobRow[],
  filters: { keywords?: string; location?: string; department?: string; boardId?: string }
): CachedJobRow[] {
  let out = jobs;
  if (filters.boardId?.trim()) {
    const b = filters.boardId.trim().toLowerCase();
    out = out.filter((j) => j.boardId.toLowerCase() === b);
  }
  if (filters.keywords?.trim()) {
    const kw = filters.keywords.trim().toLowerCase();
    out = out.filter((j) => j.title.toLowerCase().includes(kw));
  }
  if (filters.location?.trim()) {
    const loc = filters.location.trim().toLowerCase();
    out = out.filter(
      (j) => j.location && j.location.toLowerCase().includes(loc)
    );
  }
  if (filters.department?.trim()) {
    const dept = filters.department.trim().toLowerCase();
    out = out.filter(
      (j) =>
        j.department && j.department.toLowerCase().includes(dept)
    );
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywords = searchParams.get('keywords') || undefined;
    const location = searchParams.get('location') || undefined;
    const department = searchParams.get('department') || undefined;
    const boardId = searchParams.get('boardId') || undefined;
    let page = parseInt(searchParams.get('page') || '1', 10);
    if (!Number.isFinite(page) || page < 1) page = 1;

    const cache = getJobFeedCacheSync();
    if (!cache || cache.jobs.length === 0) {
      return NextResponse.json({
        jobs: [],
        page: 1,
        pageSize: AUTO_SEARCH_PAGE_SIZE,
        totalPages: 0,
        cacheUpdatedAt: cache?.updatedAt ?? null,
        boardsScanned: cache?.boardsScanned ?? 0,
        boardsFailed: cache?.boardsFailed ?? 0,
        totalMatching: 0,
        totalJobsInCache: cache?.jobs.length ?? 0,
        message:
          cache == null
            ? 'Job feed not loaded yet. Run /api/cron/job-feed with CRON_SECRET (uses headless Chrome to scrape boards).'
            : 'No jobs in cache. Check cron logs, CHROME_PATH, or board scrape errors.',
      });
    }

    const filtered = filterJobs(cache.jobs, {
      keywords,
      location,
      department,
      boardId,
    });
    const seenMs = (iso: string) => {
      const t = Date.parse(iso);
      return Number.isFinite(t) ? t : 0;
    };
    filtered.sort((a, b) => {
      const ta = seenMs(a.firstFoundAt);
      const tb = seenMs(b.firstFoundAt);
      if (tb !== ta) return tb - ta;
      const c = a.companyName.localeCompare(b.companyName);
      if (c !== 0) return c;
      return a.title.localeCompare(b.title);
    });
    const totalMatching = filtered.length;
    const totalJobsInCache = cache.jobs.length;
    const pageSize = AUTO_SEARCH_PAGE_SIZE;
    const totalPages =
      totalMatching === 0 ? 0 : Math.ceil(totalMatching / pageSize);
    const lastPage = totalPages > 0 ? totalPages : 1;
    if (page > lastPage) page = lastPage;
    const offset = (page - 1) * pageSize;
    const jobs = filtered.slice(offset, offset + pageSize);

    return NextResponse.json({
      jobs,
      page,
      pageSize,
      totalPages,
      cacheUpdatedAt: cache.updatedAt,
      boardsScanned: cache.boardsScanned,
      boardsFailed: cache.boardsFailed,
      boardErrors: cache.boardErrors,
      totalMatching,
      totalJobsInCache,
      returned: jobs.length,
    });
  } catch (e: unknown) {
    console.error('GET /api/auto-search:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
