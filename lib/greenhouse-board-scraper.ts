import type { Browser, Page } from 'puppeteer-core';
import type { JobBoardDirectoryEntry } from '@/lib/job-board-directory';
import type { CachedJobRow } from '@/lib/json-store';

const BOARD_NAV_TIMEOUT_MS = 45000;

/** Cap rows returned per board (matches aggregator limit; scroll loads more listings) */
const MAX_JOBS_PER_BOARD = 400;

/** Safety cap: paginated boards (e.g. 50 jobs/page) should stop before this */
const MAX_PAGINATION_PAGES = 60;

const PAGINATION_NAV = 'nav[aria-label="Pagination"]';
const PAGINATION_NEXT = `${PAGINATION_NAV} button.pagination__next`;

type ScrapedJobRow = {
  jobUrl: string;
  jobId: number;
  title: string;
  location: string | null;
  department: string | null;
};

async function scrollBoardList(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 24; i++) {
      window.scrollBy(0, 800);
      await delay(100);
    }
  });
}

async function extractJobsFromPage(page: Page): Promise<ScrapedJobRow[]> {
  return page.evaluate(() => {
    type Raw = {
      jobUrl: string;
      jobId: number;
      title: string;
      location: string | null;
      department: string | null;
    };
    const out: Raw[] = [];
    const seen = new Set<string>();
    const base = window.location.origin;

    document.querySelectorAll('a[href*="/jobs/"]').forEach((node) => {
      const a = node as HTMLAnchorElement;
      let href = a.getAttribute('href') || '';
      if (!href) return;
      try {
        href = new URL(href, base).href;
      } catch {
        return;
      }
      const m = href.match(/\/jobs\/(\d+)/);
      if (!m) return;
      const jobId = parseInt(m[1], 10);
      if (!Number.isFinite(jobId)) return;
      const normalized = href.replace(/[?#].*$/, '');
      if (seen.has(normalized)) return;
      seen.add(normalized);

      let title = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const root =
        a.closest('tr') ||
        a.closest('li') ||
        a.closest('[class*="opening"]') ||
        a.closest('[class*="job-post"]') ||
        a.closest('[class*="JobCard"]') ||
        a.parentElement?.parentElement;

      if ((!title || title.length < 2) && root) {
        const h = root.querySelector(
          'h2, h3, h4, h5, [class*="-title"], [class*="Title"], [class*="job-title"]'
        );
        title = (h?.textContent || '').replace(/\s+/g, ' ').trim();
      }
      if (!title) title = 'Unknown';

      let location: string | null = null;
      let department: string | null = null;
      if (root) {
        const locEl = root.querySelector(
          '[class*="location"], [class*="Location"], [data-location]'
        );
        if (locEl?.textContent) {
          location = locEl.textContent.replace(/\s+/g, ' ').trim() || null;
        }
        const depEl = root.querySelector(
          '[class*="department"], [class*="Department"], [data-department]'
        );
        if (depEl?.textContent) {
          department = depEl.textContent.replace(/\s+/g, ' ').trim() || null;
        }
      }

      out.push({ jobUrl: normalized, jobId, title, location, department });
    });
    return out;
  });
}

async function boardHasNextPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Pagination"]');
    if (!nav) return false;
    const next = nav.querySelector('button.pagination__next');
    if (!next) return false;
    return next.getAttribute('aria-disabled') !== 'true';
  });
}

async function getActivePaginationLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.querySelector('button.pagination__link--active');
    return (active?.textContent || '').replace(/\s+/g, ' ').trim() || '';
  });
}

/**
 * Load a Greenhouse board careers page in a real browser and extract job links from the DOM.
 * Used by Auto Search job-feed refresh (no boards-api.greenhouse.io calls).
 */
export async function scrapeGreenhouseBoardJobList(
  browser: Browser,
  entry: JobBoardDirectoryEntry
): Promise<{ rows: CachedJobRow[]; error?: string }> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(entry.boardUrl, {
      waitUntil: 'domcontentloaded',
      timeout: BOARD_NAV_TIMEOUT_MS,
    });

    const mergedByUrl = new Map<string, ScrapedJobRow>();

    for (let pageIndex = 0; pageIndex < MAX_PAGINATION_PAGES; pageIndex++) {
      await scrollBoardList(page);

      await page
        .waitForSelector('a[href*="/jobs/"]', { timeout: 15000 })
        .catch(() => null);

      const batch = await extractJobsFromPage(page);
      for (const row of batch) {
        mergedByUrl.set(row.jobUrl, row);
        if (mergedByUrl.size >= MAX_JOBS_PER_BOARD) break;
      }
      if (mergedByUrl.size >= MAX_JOBS_PER_BOARD) break;

      const canNext = await boardHasNextPage(page);
      if (!canNext) break;

      const beforeLabel = await getActivePaginationLabel(page);
      const nextHandle = await page.$(PAGINATION_NEXT);
      if (!nextHandle) break;
      await nextHandle.click();
      await nextHandle.dispose();

      try {
        await page.waitForFunction(
          (prev) => {
            const active = document.querySelector('button.pagination__link--active');
            const now = (active?.textContent || '').replace(/\s+/g, ' ').trim() || '';
            return now.length > 0 && now !== prev;
          },
          { timeout: 20000 },
          beforeLabel
        );
      } catch {
        break;
      }
    }

    const scraped = Array.from(mergedByUrl.values());

    const headingCompany = await page
      .evaluate(() => {
        const el =
          document.querySelector('header h1') ||
          document.querySelector('[class*="company-name"]') ||
          document.querySelector('[class*="CompanyName"]') ||
          document.querySelector('h1');
        const t = el?.textContent?.replace(/\s+/g, ' ').trim();
        return t && t.length > 0 && t.length < 120 ? t : '';
      })
      .catch(() => '');

    const companyName =
      headingCompany && headingCompany.length > 0
        ? headingCompany
        : entry.displayName;

    if (scraped.length === 0) {
      return { rows: [], error: 'No job links found on page' };
    }

    const token = entry.id;
    const rows: CachedJobRow[] = scraped.slice(0, MAX_JOBS_PER_BOARD).map((s) => ({
      boardId: entry.id,
      boardToken: token,
      boardDisplayName: entry.displayName,
      category: entry.category,
      companyName,
      jobId: s.jobId,
      title: s.title,
      location: s.location,
      department: s.department,
      jobUrl: s.jobUrl,
      firstFoundAt: '',
    }));

    return { rows };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], error: msg };
  } finally {
    await page.close().catch(() => {});
  }
}
