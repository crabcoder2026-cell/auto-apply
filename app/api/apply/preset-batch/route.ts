import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  createApplicationHistory,
  getActiveTemplate,
  listApplicationHistory,
} from '@/lib/json-store';
import {
  applyToBatchJobs,
  BATCH_DEFAULT_MAX_JOBS,
  dedupeKeyFromJobUrl,
  normalizeJobUrlForDedupe,
} from '@/lib/greenhouse-automation';
import { getPresetBoardById } from '@/lib/preset-boards';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const boardIds: unknown = body.boardIds;
    const filters = body.filters ?? {};

    if (!Array.isArray(boardIds) || boardIds.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one company board' },
        { status: 400 }
      );
    }

    const template = await getActiveTemplate(userId);
    if (!template) {
      return NextResponse.json(
        {
          error:
            'No active application template found. Please create one first.',
        },
        { status: 400 }
      );
    }

    const filterObj = {
      keywords: filters.keywords || undefined,
      location: filters.location || undefined,
      department: filters.department || undefined,
    };

    const history = await listApplicationHistory(userId);
    const appliedJobUrls = new Set<string>();
    for (const h of history) {
      if (h.status !== 'success' && h.status !== 'requires_manual') continue;
      const nu = normalizeJobUrlForDedupe(h.jobUrl);
      if (nu) appliedJobUrls.add(nu);
      const dk = dedupeKeyFromJobUrl(h.jobUrl);
      if (dk) appliedJobUrls.add(dk);
    }

    const allResults: Awaited<ReturnType<typeof applyToBatchJobs>> = [];
    let remaining = BATCH_DEFAULT_MAX_JOBS;

    for (const id of boardIds) {
      if (typeof id !== 'string') continue;
      if (remaining <= 0) break;
      const preset = getPresetBoardById(id);
      if (!preset) continue;

      const results = await applyToBatchJobs(preset.url, template, filterObj, {
        appliedJobUrls,
        maxJobs: remaining,
      });
      allResults.push(...results);

      for (const r of results) {
        if (r.jobUrl) {
          const nu = normalizeJobUrlForDedupe(r.jobUrl);
          if (nu) appliedJobUrls.add(nu);
          const dk = dedupeKeyFromJobUrl(r.jobUrl);
          if (dk) appliedJobUrls.add(dk);
        }
      }
      remaining -= results.filter((r) => Boolean(r.jobUrl)).length;

      await Promise.all(
        results.map((result) =>
          createApplicationHistory({
            userId,
            jobTitle: result.jobInfo.jobTitle,
            companyName: result.jobInfo.companyName,
            jobUrl: result.jobUrl || preset.url,
            location: result.jobInfo.location || null,
            department: result.jobInfo.department || null,
            status: result.status,
            errorMessage: result.errorMessage || null,
            applicationData: {
              source: 'preset_batch',
              boardId: id,
              boardName: preset.name,
              template: {
                fullName: template.fullName,
                email: template.email,
                phone: template.phone,
              },
            },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      results: allResults,
      totalApplied: allResults.length,
      successCount: allResults.filter((r) => r.status === 'success').length,
      failedCount: allResults.filter((r) => r.status === 'failed').length,
      manualCount: allResults.filter((r) => r.status === 'requires_manual')
        .length,
    });
  } catch (error: unknown) {
    console.error('Preset batch error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to submit batch applications', details: msg },
      { status: 500 }
    );
  }
}
