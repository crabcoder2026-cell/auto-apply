import {
  createApplicationHistory,
  getActiveTemplate,
  getJobFeedCacheSync,
  getWatchConfig,
  listApplicationHistory,
  mergeAppliedJobKeys,
  upsertWatchConfig,
  type CachedJobRow,
} from '@/lib/json-store';
import {
  normalizeStoredBoardJobKey,
  stableBoardJobKey,
} from '@/lib/board-job-dedupe';
import { JOB_BOARD_DIRECTORY } from '@/lib/job-board-directory';
import { runExclusiveChromeAutomation } from '@/lib/chrome-automation-queue';
import {
  applyToSingleJob,
  dedupeKeyFromJobUrl,
  launchBrowser,
  normalizeJobUrlForDedupe,
  type ApplicationResult,
} from '@/lib/greenhouse-automation';
import type { Browser } from 'puppeteer-core';

/**
 * Max applications per Auto pilot run (jobs taken from the Auto Search feed).
 * Override with env `WATCH_MAX_JOBS_PER_RUN` (integer 1–200); default 30.
 */
const _watchMaxRun = parseInt(process.env.WATCH_MAX_JOBS_PER_RUN || '', 10);
export const WATCH_MAX_JOBS_PER_RUN =
  Number.isFinite(_watchMaxRun) && _watchMaxRun >= 1 && _watchMaxRun <= 200
    ? _watchMaxRun
    : 30;

const DIRECTORY_BOARD_IDS = new Set(JOB_BOARD_DIRECTORY.map((b) => b.id));

const HISTORY_STATUSES_SKIP_REAPPLY = new Set(['success', 'requires_manual']);

function collectKeysFromResults(results: ApplicationResult[]): string[] {
  const keys: string[] = [];
  for (const r of results) {
    const k = dedupeKeyFromJobUrl(r.jobUrl);
    if (k) keys.push(k);
  }
  return keys;
}

function filterCachedJobsForWatch(
  jobs: CachedJobRow[],
  filters: {
    keywords?: string;
    location?: string;
    department?: string;
  },
  allowedBoardIds: Set<string> | null
): CachedJobRow[] {
  let out = jobs;
  if (allowedBoardIds && allowedBoardIds.size > 0) {
    out = out.filter((j) => allowedBoardIds.has(j.boardId));
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
      (j) => j.department && j.department.toLowerCase().includes(dept)
    );
  }
  return out;
}

function seenMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function rowPassesDedupe(
  row: CachedJobRow,
  dedupeSet: Set<string>,
  appliedJobUrls: Set<string>
): boolean {
  const key = stableBoardJobKey(row.boardToken, row.jobId);
  if (dedupeSet.has(key)) return false;
  if (appliedJobUrls.has(key)) return false;
  const nu = normalizeJobUrlForDedupe(row.jobUrl);
  if (nu && appliedJobUrls.has(nu)) return false;
  return true;
}

/**
 * Run auto-apply for one user using the **shared Auto Search job feed** (same boards as
 * Auto Search). Does not scrape each company board separately — candidates come from
 * `getJobFeedCacheSync()` populated by `/api/cron/job-feed`.
 */
export async function runWatchForUser(userId: string): Promise<{
  summary: string;
  newKeys: string[];
  totalAttempts: number;
  successCount: number;
}> {
  const config = await getWatchConfig(userId);
  if (!config.enabled) {
    return {
      summary: 'Auto pilot disabled',
      newKeys: [],
      totalAttempts: 0,
      successCount: 0,
    };
  }

  const template = await getActiveTemplate(userId);
  if (!template) {
    return {
      summary: 'No active template — save your profile first',
      newKeys: [],
      totalAttempts: 0,
      successCount: 0,
    };
  }

  const workingDedupe = new Set(
    config.appliedJobKeys.map((k) => normalizeStoredBoardJobKey(k))
  );

  const appliedJobUrls = new Set<string>();
  const priorHistory = await listApplicationHistory(userId);
  for (const h of priorHistory) {
    if (!HISTORY_STATUSES_SKIP_REAPPLY.has(h.status)) continue;
    const k = dedupeKeyFromJobUrl(h.jobUrl);
    if (k) workingDedupe.add(k);
    const nu = normalizeJobUrlForDedupe(h.jobUrl);
    if (nu) appliedJobUrls.add(nu);
    if (k) appliedJobUrls.add(k);
  }

  const filters = {
    keywords: config.keywords?.trim() || undefined,
    location: config.location?.trim() || undefined,
    department: config.department?.trim() || undefined,
  };

  const cache = getJobFeedCacheSync();
  if (!cache || cache.jobs.length === 0) {
    return {
      summary:
        'No job feed data — run /api/cron/job-feed (Auto Search) so listings are available.',
      newKeys: [],
      totalAttempts: 0,
      successCount: 0,
    };
  }

  let rows = cache.jobs.filter((j) => DIRECTORY_BOARD_IDS.has(j.boardId));
  const selected =
    config.selectedBoardIds.length > 0
      ? new Set(config.selectedBoardIds)
      : null;
  rows = filterCachedJobsForWatch(rows, filters, selected);

  rows = rows.filter((r) => rowPassesDedupe(r, workingDedupe, appliedJobUrls));

  rows.sort((a, b) => {
    const tb = seenMs(b.firstFoundAt);
    const ta = seenMs(a.firstFoundAt);
    if (tb !== ta) return tb - ta;
    const c = a.companyName.localeCompare(b.companyName);
    if (c !== 0) return c;
    return a.title.localeCompare(b.title);
  });

  const candidates = rows.slice(0, WATCH_MAX_JOBS_PER_RUN);

  if (candidates.length === 0) {
    await upsertWatchConfig(userId, {
      lastRunAt: new Date().toISOString(),
      lastRunSummary: 'No new matching jobs to apply (feed + filters + dedupe)',
    });
    return {
      summary: 'No new matching jobs to apply',
      newKeys: [],
      totalAttempts: 0,
      successCount: 0,
    };
  }

  const results: ApplicationResult[] = [];

  await runExclusiveChromeAutomation(async () => {
    let batchBrowser: Browser | null = null;
    try {
      batchBrowser = await launchBrowser();
      for (const row of candidates) {
        const result = await applyToSingleJob(row.jobUrl, template, {
          reuseBrowser: batchBrowser,
        });
        result.jobUrl = row.jobUrl;
        result.jobInfo = {
          jobTitle: row.title,
          companyName: row.companyName,
          location: row.location || 'Unknown',
          department: row.department || 'Unknown',
        };
        results.push(result);

        await createApplicationHistory({
          userId,
          jobTitle: row.title,
          companyName: row.companyName,
          jobUrl: row.jobUrl,
          location: row.location,
          department: row.department,
          status: result.status,
          errorMessage: result.errorMessage || null,
          applicationData: {
            source: 'watch',
            boardId: row.boardId,
            boardName: row.boardDisplayName,
          },
        });

        await new Promise((r) => setTimeout(r, 3000));
      }
    } finally {
      if (batchBrowser) {
        await batchBrowser.close().catch((err) =>
          console.warn('[Puppeteer] watch batch browser.close failed:', err)
        );
      }
    }
  });

  let successCount = 0;
  for (const r of results) {
    if (r.status === 'success') successCount += 1;
  }

  const newKeys = collectKeysFromResults(results);

  await mergeAppliedJobKeys(userId, newKeys);

  const summary =
    results.length === 0
      ? 'No new matching jobs to apply'
      : `Applied ${results.length} job(s): ${successCount} succeeded`;

  await upsertWatchConfig(userId, {
    lastRunAt: new Date().toISOString(),
    lastRunSummary: summary,
  });

  return { summary, newKeys, totalAttempts: results.length, successCount };
}
