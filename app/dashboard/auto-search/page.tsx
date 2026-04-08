'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { ApplicationStatusBadge } from '@/components/application-status-badge';
import { AUTO_SEARCH_PAGE_SIZE } from '@/lib/auto-search-config';
import { JOB_BOARD_DIRECTORY } from '@/lib/job-board-directory';
import type { CachedJobRow } from '@/lib/json-store';
import { runInFlight, useInFlight, useInFlightMeta } from '@/lib/in-flight';

interface HistoryRow {
  jobUrl: string;
  status: string;
  appliedAt: string;
}

function normalizeJobUrlForMatch(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '') || '/';
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim();
  }
}

function buildHistoryStatusMap(history: HistoryRow[]): Map<string, HistoryRow> {
  const map = new Map<string, HistoryRow>();
  for (const h of history) {
    const key = normalizeJobUrlForMatch(h.jobUrl);
    const prev = map.get(key);
    if (
      !prev ||
      new Date(h.appliedAt).getTime() > new Date(prev.appliedAt).getTime()
    ) {
      map.set(key, h);
    }
  }
  return map;
}

export default function AutoSearchPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CachedJobRow[]>([]);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [totalMatching, setTotalMatching] = useState(0);
  const [totalJobsInCache, setTotalJobsInCache] = useState(0);
  const [returned, setReturned] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(AUTO_SEARCH_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(0);
  const [boardsFailed, setBoardsFailed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [boardId, setBoardId] = useState('');

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);
  const applyBusy = useInFlight('apply:auto');
  const applyTargetUrl = useInFlightMeta('apply:auto');
  const fetchBusy = useInFlight('auto-search:fetch');
  const initialBusy = useInFlight('auto-search:initial');
  const listOrFetchBusy = loading || fetchBusy || initialBusy;

  const statusByUrl = useMemo(
    () => buildHistoryStatusMap(history),
    [history]
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) return;
      const data = await res.json();
      const apps = (data?.applications || []) as HistoryRow[];
      setHistory(apps);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchJobsWithFilters = useCallback(
    async (
      kw: string,
      loc: string,
      dept: string,
      board: string,
      pageNum: number
    ) => {
      setError('');
      setMessage(null);
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      if (kw.trim()) params.set('keywords', kw.trim());
      if (loc.trim()) params.set('location', loc.trim());
      if (dept.trim()) params.set('department', dept.trim());
      if (board.trim()) params.set('boardId', board.trim());
      const q = params.toString();
      const url = `/api/auto-search?${q}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load jobs');
      setJobs(data.jobs || []);
      setCacheUpdatedAt(data.cacheUpdatedAt ?? null);
      setTotalMatching(data.totalMatching ?? 0);
      setTotalJobsInCache(data.totalJobsInCache ?? 0);
      setReturned(data.returned ?? 0);
      setPage(data.page ?? pageNum);
      setPageSize(data.pageSize ?? AUTO_SEARCH_PAGE_SIZE);
      setTotalPages(data.totalPages ?? 0);
      setBoardsFailed(data.boardsFailed ?? 0);
      if (typeof data.message === 'string') setMessage(data.message);
      else setMessage(null);
    },
    []
  );

  const filtersRef = useRef({ keywords, location, department, boardId, page });
  filtersRef.current = { keywords, location, department, boardId, page };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        await runInFlight('auto-search:initial', async () => {
          await fetchJobsWithFilters('', '', '', '', 1);
          await loadHistory();
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchJobsWithFilters, loadHistory]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const f = filtersRef.current;
      runInFlight('auto-search:fetch', async () => {
        await fetchJobsWithFilters(
          f.keywords,
          f.location,
          f.department,
          f.boardId,
          f.page
        );
        await loadHistory();
      }).catch(() => {});
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchJobsWithFilters, loadHistory]);

  const onApply = async (jobUrl: string) => {
    setApplyError(null);
    try {
      await runInFlight(
        'apply:auto',
        async () => {
          const res = await fetch('/api/apply/single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobUrl }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || data.details || 'Apply failed');
          await loadHistory();
        },
        { meta: jobUrl }
      );
    } catch (e: unknown) {
      setApplyError(e instanceof Error ? e.message : 'Apply failed');
    }
  };

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPage(1);
    setLoading(true);
    try {
      await runInFlight('auto-search:fetch', async () => {
        await fetchJobsWithFilters(keywords, location, department, boardId, 1);
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const refreshNow = async () => {
    setError('');
    setLoading(true);
    try {
      await runInFlight('auto-search:fetch', async () => {
        await fetchJobsWithFilters(
          keywords,
          location,
          department,
          boardId,
          page
        );
        await loadHistory();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = async (nextPage: number) => {
    if (nextPage < 1 || (totalPages > 0 && nextPage > totalPages)) return;
    setError('');
    setLoading(true);
    setPage(nextPage);
    try {
      await runInFlight('auto-search:fetch', async () => {
        await fetchJobsWithFilters(
          keywords,
          location,
          department,
          boardId,
          nextPage
        );
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-0">
      <div className="bg-card rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Search className="h-7 w-7 text-brand-green" />
          Auto Search
        </h1>
        <p className="text-muted-foreground mt-2">
          Openings from curated Greenhouse boards are saved in a <strong>shared job feed</strong>{' '}
          (full board listings). The table shows only rows that match your filters (e.g.
          keyword in title). <strong>First found</strong> is the first time Auto Search saw
          that posting; it does not change if the same job appears again on a later scrape.
          The feed is rebuilt on a schedule (about every 30 minutes) using{' '}
          <strong>headless Chrome</strong> on each board page — not the Greenhouse JSON API.
          Click <strong>Apply</strong> to run automation for that role using your saved
          template. Track outcomes in{' '}
          <Link href="/dashboard/history" className="text-brand-green font-medium hover:underline">
            History
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This page also refreshes in the background every 30 minutes while it stays
          open. For hands-off applying to matching roles, use{' '}
          <Link href="/dashboard/watch" className="text-brand-green font-medium hover:underline">
            Auto pilot
          </Link>
          .
        </p>
      </div>

      <form
        onSubmit={onSearch}
        className="bg-card rounded-xl shadow-md p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Company
            </label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green bg-card"
            >
              <option value="">All companies</option>
              {JOB_BOARD_DIRECTORY.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Keywords (title)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. engineer"
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. remote, SF"
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="submit"
            disabled={listOrFetchBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-orange text-white rounded-lg font-medium hover:bg-brand-orange-hover disabled:opacity-50"
          >
            {listOrFetchBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => refreshNow()}
            disabled={listOrFetchBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-brand-green text-brand-green rounded-lg font-medium hover:bg-brand-green-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${listOrFetchBusy ? 'animate-spin' : ''}`} />
            Refresh now
          </button>
          <span className="text-sm text-muted-foreground">
            Cache updated:{' '}
            {cacheUpdatedAt
              ? new Date(cacheUpdatedAt).toLocaleString()
              : '—'}
            {totalJobsInCache > 0 && (
              <>
                {' '}
                · {totalJobsInCache} job{totalJobsInCache === 1 ? '' : 's'} in feed
                {totalMatching !== totalJobsInCache && (
                  <>
                    {' '}
                    · {totalMatching} match
                    {totalMatching === 1 ? '' : 'es'} after filters
                  </>
                )}
              </>
            )}
            {totalMatching > 0 && totalPages > 0 && (
              <>
                {' '}
                · Page {page} of {totalPages} ({pageSize} per page)
              </>
            )}
            {boardsFailed > 0 && (
              <span className="text-amber-700">
                {' '}
                · {boardsFailed} board(s) failed to load
              </span>
            )}
          </span>
        </div>
        {message && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {message}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </p>
        )}
        {applyError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {applyError}
          </p>
        )}
      </form>

      <div className="bg-card rounded-xl shadow-md overflow-hidden">
        {totalMatching > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              {returned > 0 ? (
                <>
                  Rows {(page - 1) * pageSize + 1}–
                  {(page - 1) * pageSize + returned} of {totalMatching}
                  {totalPages > 1 && (
                    <span className="text-muted-foreground/80">
                      {' '}
                      · {pageSize} per page
                    </span>
                  )}
                </>
              ) : (
                <>No rows on this page</>
              )}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={listOrFetchBusy || page <= 1}
                  onClick={() => goToPage(page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm text-foreground tabular-nums px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={listOrFetchBusy || page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Company
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Title
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Location
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground whitespace-nowrap">
                  First found
                </th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">
                  Status
                </th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {listOrFetchBusy && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-green mx-auto" />
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No jobs match your filters, or the feed has not been populated yet.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const hist = statusByUrl.get(
                    normalizeJobUrlForMatch(job.jobUrl)
                  );
                  return (
                    <tr
                      key={`${job.boardToken}-${job.jobId}`}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">
                          {job.companyName}
                        </div>
                        <div className="text-xs text-muted-foreground">{job.category}</div>
                      </td>
                      <td className="py-3 px-4 text-foreground max-w-xs">
                        <span className="line-clamp-2">{job.title}</span>
                        {job.department && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {job.department}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                        {job.location || '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-xs">
                        {job.firstFoundAt
                          ? new Date(job.firstFoundAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {hist ? (
                          <ApplicationStatusBadge status={hist.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Not applied</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <a
                            href={job.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-green hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </a>
                          <button
                            type="button"
                            disabled={applyBusy}
                            onClick={() => onApply(job.jobUrl)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-green text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {applyBusy && applyTargetUrl === job.jobUrl ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Apply
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalMatching > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/30">
            <button
              type="button"
              disabled={listOrFetchBusy || page <= 1}
              onClick={() => goToPage(page - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-foreground tabular-nums px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={listOrFetchBusy || page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
        <p className="font-semibold">Refreshing the job feed (about every 30 minutes)</p>
        <p>
          Set <code className="bg-amber-100 px-1 rounded">CRON_SECRET</code> and call:
        </p>
        <pre className="bg-card/80 border border-amber-200 rounded-lg p-3 overflow-x-auto text-xs">
          {`curl -sS -H "Authorization: Bearer $CRON_SECRET" \\
  "$NEXTAUTH_URL/api/cron/job-feed"`}
        </pre>
        <p className="text-amber-900/90">
          The server must have Chrome/Chromium available (same as Apply): set{' '}
          <code className="bg-amber-100 px-1 rounded">CHROME_PATH</code> on Linux if needed.
          Scraping every board can take several minutes; long serverless timeouts may not
          finish on Vercel — prefer running this cron on a VPS or EC2 with{' '}
          <code className="bg-amber-100 px-1 rounded">vercel.json</code> optional.
        </p>
      </div>
    </div>
  );
}
