export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { testImapConnection, IMAP_PRESETS } from '@/lib/email-checker';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { imapHost, imapPort, email, imapPassword, provider } = body;

    // Resolve preset if provider given
    let host = imapHost;
    let port = imapPort ? parseInt(imapPort, 10) : 993;
    if (provider && IMAP_PRESETS[provider]) {
      host = host || IMAP_PRESETS[provider].host;
      port = port || IMAP_PRESETS[provider].port;
    }

    if (!host || !email || !imapPassword) {
      return NextResponse.json(
        { error: 'IMAP host, email, and password are required' },
        { status: 400 }
      );
    }

    const result = await testImapConnection({
      host,
      port,
      email,
      password: imapPassword,
      tls: true,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('IMAP test error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to test IMAP connection' },
      { status: 500 }
    );
  }
}
