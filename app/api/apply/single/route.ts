import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { applyToSingleJob } from '@/lib/greenhouse-automation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { jobUrl } = await request.json();

    if (!jobUrl) {
      return NextResponse.json(
        { error: 'Job URL is required' },
        { status: 400 }
      );
    }

    // Validate URL is a Greenhouse job posting
    if (!jobUrl.includes('greenhouse.io') && !jobUrl.includes('boards.greenhouse.io')) {
      return NextResponse.json(
        { error: 'Invalid Greenhouse job URL' },
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

    // Apply to the job
    const result = await applyToSingleJob(jobUrl, template);

    // Save to application history
    const history = await prisma.applicationHistory.create({
      data: {
        userId,
        jobTitle: result.jobInfo.jobTitle,
        companyName: result.jobInfo.companyName,
        jobUrl,
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
    });

    return NextResponse.json({
      success: result.success,
      result,
      history,
    });
  } catch (error: any) {
    console.error('Application error:', error);
    return NextResponse.json(
      { error: 'Failed to submit application', details: error?.message },
      { status: 500 }
    );
  }
}
