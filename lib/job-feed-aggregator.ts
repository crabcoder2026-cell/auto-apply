import { launchBrowser } from '@/lib/greenhouse-automation';
import { scrapeGreenhouseBoardJobList } from '@/lib/greenhouse-board-scraper';
import { JOB_BOARD_DIRECTORY } from '@/lib/job-board-directory';
import type { CachedJobRow, JobFeedCache } from '@/lib/json-store';
import { getJobFeedCacheSync, setJobFeedCache } from '@/lib/json-store';

function stableJobKey(row: Pick<CachedJobRow, 'boardToken' | 'jobId'>): string {
  return `${row.boardToken}:${row.jobId}`;
}

/**
 * Auto Search refreshes via headless Chrome (DOM scrape per board).
 * Requires CHROME_PATH / PUPPETEER_EXECUTABLE_PATH or auto-detected Chrome, or Sparticuz on Lambda.
 * Sequential boards in one browser to limit memory; expect several minutes for full directory.
 */
export async function refreshJobFeedCache(): Promise<{
  boardsOk: number;
  boardsFailed: number;
  jobCount: number;
  durationMs: number;
}> {
  const start = Date.now();
  const boardErrors: { boardId: string; message: string }[] = [];
  const jobs: CachedJobRow[] = [];

  const browser = await launchBrowser();
  try {
    for (const entry of JOB_BOARD_DIRECTORY) {
      const { rows, error } = await scrapeGreenhouseBoardJobList(browser, entry);
      if (error || rows.length === 0) {
        boardErrors.push({
          boardId: entry.id,
          message: error || 'No jobs scraped',
        });
        continue;
      }
      jobs.push(...rows);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const boardsFailed = boardErrors.length;
  const boardsOk = JOB_BOARD_DIRECTORY.length - boardsFailed;

  const prev = getJobFeedCacheSync();
  const firstSeenByJobKey: Record<string, string> = {
    ...(prev?.firstSeenByJobKey ?? {}),
  };
  const nowIso = new Date().toISOString();

  for (const row of jobs) {
    const k = stableJobKey(row);
    const prior = firstSeenByJobKey[k];
    if (prior) {
      row.firstFoundAt = prior;
    } else {
      firstSeenByJobKey[k] = nowIso;
      row.firstFoundAt = nowIso;
    }
  }

  const cache: JobFeedCache = {
    updatedAt: nowIso,
    boardsScanned: JOB_BOARD_DIRECTORY.length,
    boardsFailed,
    boardErrors,
    jobs,
    firstSeenByJobKey,
  };

  await setJobFeedCache(cache);

  return {
    boardsOk,
    boardsFailed,
    jobCount: jobs.length,
    durationMs: Date.now() - start,
  };
}
