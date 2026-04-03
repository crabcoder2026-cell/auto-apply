import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  createTemplate,
  deactivateTemplatesForUser,
  getActiveTemplate,
} from '@/lib/json-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const template = await getActiveTemplate(userId);

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();

    const {
      resumePath,
      resumeFileName,
      fullName,
      email,
      phone,
      linkedinUrl,
      portfolioUrl,
      coverLetter,
      workAuthStatus,
      yearsExperience,
      currentLocation,
      additionalFields: rawAdditionalFields,
      country,
      imapProvider,
      imapHost,
      imapPort,
      imapPassword,
    } = body;

    const additionalFields = {
      ...(rawAdditionalFields || {}),
      ...(country ? { country } : {}),
      ...(imapProvider ? { imapProvider } : {}),
      ...(imapHost ? { imapHost } : {}),
      ...(imapPort ? { imapPort } : {}),
      ...(imapPassword ? { imapPassword } : {}),
    };

    await deactivateTemplatesForUser(userId);

    const template = await createTemplate({
      userId,
      resumePath: resumePath || null,
      resumeFileName: resumeFileName || null,
      fullName,
      email,
      phone: phone || null,
      linkedinUrl: linkedinUrl || null,
      portfolioUrl: portfolioUrl || null,
      coverLetter: coverLetter || null,
      workAuthStatus: workAuthStatus || null,
      yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : null,
      currentLocation: currentLocation || null,
      additionalFields: additionalFields || null,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
