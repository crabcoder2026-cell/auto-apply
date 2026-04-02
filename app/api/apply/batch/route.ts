import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { applyToBatchJobs } from '@/lib/greenhouse-automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { boardUrl, filters } = await request.json();

    if (!boardUrl) {
      return NextResponse.json(
        { error: 'Board URL is required' },
        { status: 400 }
      );
    }

    // Validate URL is a Greenhouse job board
    if (!boardUrl.includes('greenhouse.io') && !boardUrl.includes('boards.greenhouse.io')) {
      return NextResponse.json(
        { error: 'Invalid Greenhouse board URL' },
        { status: 400 }
      );
    }

    // Get user's active template
    const template = await prisma.applicationTemplate.findFirst({
      where: {
        userId,
        isActive: true,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'No active application template found. Please create one first.' },
        { status: 400 }
      );
    }

    // Apply to jobs
    const results = await applyToBatchJobs(boardUrl, template, filters);

    // Save all results to application history
    const historyPromises = results.map((result) =>
      prisma.applicationHistory.create({
        data: {
          userId,
          jobTitle: result.jobInfo.jobTitle,
          companyName: result.jobInfo.companyName,
          jobUrl: boardUrl,
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
  } catch (error: any) {
    console.error('Batch application error:', error);
    return NextResponse.json(
      { error: 'Failed to submit batch applications', details: error?.message },
      { status: 500 }
    );
  }
}
