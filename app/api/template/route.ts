import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Fetch user's active application template
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const template = await prisma.applicationTemplate.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// POST: Create or update application template
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
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

    // Merge country and IMAP settings into additionalFields
    const additionalFields = {
      ...(rawAdditionalFields || {}),
      ...(country ? { country } : {}),
      ...(imapProvider ? { imapProvider } : {}),
      ...(imapHost ? { imapHost } : {}),
      ...(imapPort ? { imapPort } : {}),
      ...(imapPassword ? { imapPassword } : {}),
    };

    // Deactivate old templates
    await prisma.applicationTemplate.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create new template
    const template = await prisma.applicationTemplate.create({
      data: {
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
        yearsExperience: yearsExperience ? parseInt(yearsExperience) : null,
        currentLocation: currentLocation || null,
        additionalFields: additionalFields || null,
        isActive: true,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
