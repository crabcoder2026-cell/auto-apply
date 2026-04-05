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
  isValidJobPageUrl,
  normalizeJobUrlForDedupe,
  resolveGreenhouseBoardInputUrl,
} from '@/lib/greenhouse-automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardUrl, filters } = await request.json();

    if (!boardUrl) {
      return NextResponse.json(
        { error: 'Board URL is required' },
        { status: 400 }
      );
    }

    if (!isValidJobPageUrl(boardUrl)) {
      return NextResponse.json(
        { error: 'Enter a valid http(s) board or careers page URL' },
        { status: 400 }
      );
    }

    const resolvedBoardUrl = await resolveGreenhouseBoardInputUrl(boardUrl);
    if (!resolvedBoardUrl) {
      return NextResponse.json(
        {
          error:
            'Could not find a Greenhouse job board on that page. Use a direct boards.greenhouse.io or job-boards.greenhouse.io board URL, or a careers page that embeds Greenhouse.',
        },
        { status: 400 }
      );
    }

    const template = await getActiveTemplate(userId);

    if (!template) {
      return NextResponse.json(
        { error: 'No active application template found. Please create one first.' },
        { status: 400 }
      );
    }

    const history = await listApplicationHistory(userId);
    const appliedJobUrls = new Set(
      history
        .filter((h) => h.status === 'success')
        .map((h) => normalizeJobUrlForDedupe(h.jobUrl))
        .filter(Boolean)
    );

    const results = await applyToBatchJobs(resolvedBoardUrl, template, filters, {
      appliedJobUrls,
      maxJobs: BATCH_DEFAULT_MAX_JOBS,
    });

    const historyPromises = results.map((result) =>
      createApplicationHistory({
        userId,
        jobTitle: result.jobInfo.jobTitle,
        companyName: result.jobInfo.companyName,
        jobUrl: result.jobUrl || resolvedBoardUrl,
        location: result.jobInfo.location || null,
        department: result.jobInfo.department || null,
        status: result.status,
        errorMessage: result.errorMessage || null,
        applicationData: {
          template: {
            fullName: template.fullName,
            email: template.email,
            phone: template.phone,
          },
        },
      })
    );

    await Promise.all(historyPromises);

    return NextResponse.json({
      success: true,
      results,
      totalApplied: results.length,
      successCount: results.filter((r) => r.status === 'success').length,
      failedCount: results.filter((r) => r.status === 'failed').length,
      manualCount: results.filter((r) => r.status === 'requires_manual').length,
    });
  } catch (error: unknown) {
    console.error('Batch application error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to submit batch applications', details: msg },
      { status: 500 }
    );
  }
}
