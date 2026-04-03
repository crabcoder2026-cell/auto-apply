import {
  createApplicationHistory,
  getActiveTemplate,
  getWatchConfig,
  mergeAppliedJobKeys,
  upsertWatchConfig,
} from '@/lib/json-store';
import {
  applyToBatchJobs,
  extractBoardToken,
  type ApplicationResult,
} from '@/lib/greenhouse-automation';
import { getPresetBoardById } from '@/lib/preset-boards';

/** Max jobs per board per watch/cron run (avoid timeouts) */
export const WATCH_MAX_JOBS_PER_BOARD = 5;

function collectKeysFromResults(results: ApplicationResult[]): string[] {
  const keys: string[] = [];
  for (const r of results) {
    if (!r.jobUrl) continue;
    const tok = extractBoardToken(r.jobUrl);
    const m = r.jobUrl.match(/\/jobs\/(\d+)/);
    if (tok && m) keys.push(`${tok}:${m[1]}`);
  }
  return keys;
}

/**
 * Run auto-apply for one user: selected preset boards, filters, dedupe against stored keys.
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
  if (config.selectedBoardIds.length === 0) {
    return {
      summary: 'No boards selected',
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

  const dedupeSet = new Set(config.appliedJobKeys);
  const filters = {
    keywords: config.keywords?.trim() || undefined,
    location: config.location?.trim() || undefined,
    department: config.department?.trim() || undefined,
  };

  const newKeys: string[] = [];
  let totalAttempts = 0;
  let successCount = 0;

  for (const boardId of config.selectedBoardIds) {
    const preset = getPresetBoardById(boardId);
    if (!preset) continue;

    const results = await applyToBatchJobs(
      preset.url,
      template,
      filters,
      { dedupeKeys: dedupeSet, maxJobs: WATCH_MAX_JOBS_PER_BOARD }
    );

    for (const r of results) {
      totalAttempts += 1;
      if (r.status === 'success') successCount += 1;

      await createApplicationHistory({
        userId,
        jobTitle: r.jobInfo.jobTitle,
        companyName: r.jobInfo.companyName,
        jobUrl: r.jobUrl || preset.url,
        location: r.jobInfo.location || null,
        department: r.jobInfo.department || null,
        status: r.status,
        errorMessage: r.errorMessage || null,
        applicationData: {
          source: 'watch',
          boardId,
          boardName: preset.name,
        },
      });
    }

    const batchKeys = collectKeysFromResults(results);
    for (const k of batchKeys) {
      newKeys.push(k);
      dedupeSet.add(k);
    }
  }

  await mergeAppliedJobKeys(userId, newKeys);

  const summary =
    totalAttempts === 0
      ? 'No new matching jobs to apply'
      : `Applied ${totalAttempts} job(s): ${successCount} succeeded`;

  await upsertWatchConfig(userId, {
    lastRunAt: new Date().toISOString(),
    lastRunSummary: summary,
  });

  return { summary, newKeys, totalAttempts, successCount };
}
