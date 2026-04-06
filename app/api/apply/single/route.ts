import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { createApplicationHistory, getActiveTemplate } from '@/lib/json-store';
import {
  applyToSingleJob,
  isValidJobPageUrl,
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

    const { jobUrl } = await request.json();

    if (!jobUrl) {
      return NextResponse.json(
        { error: 'Job URL is required' },
        { status: 400 }
      );
    }

    if (!isValidJobPageUrl(jobUrl)) {
      return NextResponse.json(
        { error: 'Enter a valid http(s) job or careers page URL' },
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

    const result = await applyToSingleJob(jobUrl, template);

    const history = await createApplicationHistory({
      userId,
      jobTitle: result.jobInfo.jobTitle,
      companyName: result.jobInfo.companyName,
      jobUrl,
      location: result.jobInfo.location || null,
      department: result.jobInfo.department || null,
      status: result.status,
      errorMessage: result.errorMessage || null,
      applicationData: {
        source: 'single',
        template: {
          fullName: template.fullName,
          email: template.email,
          phone: template.phone,
        },
      },
    });

    return NextResponse.json({
      success: result.success,
      result,
      history,
    });
  } catch (error: unknown) {
    console.error('Application error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to submit application', details: msg },
      { status: 500 }
    );
  }
}
