/**
 * Email checker utility for fetching Greenhouse security verification codes.
 * Uses IMAP to connect to the user's email inbox and extract the code.
 */

import { ImapFlow } from 'imapflow';

export interface ImapConfig {
  host: string;
  port: number;
  email: string;
  password: string;
  tls?: boolean;
}

/** Common IMAP presets for popular email providers */
export const IMAP_PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: 'imap.gmail.com', port: 993 },
  outlook: { host: 'outlook.office365.com', port: 993 },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993 },
  icloud: { host: 'imap.mail.me.com', port: 993 },
  aol: { host: 'imap.aol.com', port: 993 },
};

/**
 * Decode quoted-printable encoded text.
 */
function decodeQuotedPrintable(text: string): string {
  // Remove soft line breaks (= at end of line)
  let result = text.replace(/=\r?\n/g, '');
  // Decode =XX hex sequences
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return result;
}

/**
 * Extract the text body from a raw MIME email, stripping headers and decoding.
 * Raw IMAP emails include headers (DKIM, Message-ID, boundaries) that contain
 * random alphanumeric strings that can be falsely matched as security codes.
 */
function extractEmailTextBody(rawEmail: string): string {
  // Step 1: Find the MIME boundary from the top-level Content-Type header
  const boundaryMatch = rawEmail.match(/Content-Type:\s*multipart\/[^\r\n]*boundary="?([^"\r\n;]+)"?/i);
  
  if (boundaryMatch?.[1]) {
    const boundary = boundaryMatch[1].trim();
    console.log(`[extractEmailTextBody] Found MIME boundary: ${boundary}`);
    
    // Split email into MIME parts
    const parts = rawEmail.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
    
    // Look through parts for text/plain
    for (const part of parts) {
      const contentTypeMatch = part.match(/Content-Type:\s*text\/plain/i);
      if (contentTypeMatch) {
        console.log('[extractEmailTextBody] Found text/plain MIME part');
        
        // Find the body of this part (after the blank line that separates headers from body)
        const blankLineIdx = part.search(/\r?\n\r?\n/);
        if (blankLineIdx === -1) continue;
        
        let body = part.substring(blankLineIdx).replace(/^\r?\n\r?\n/, '');
        
        // Remove trailing MIME boundary markers
        body = body.replace(/\r?\n--\s*$/, '').replace(/--\s*$/, '');
        
        // Check if it's quoted-printable encoded
        const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(part);
        if (isQP) {
          body = decodeQuotedPrintable(body);
        }
        
        // Check if it's base64 encoded
        const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);
        if (isBase64) {
          try {
            body = Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
          } catch { /* leave as-is */ }
        }
        
        console.log(`[extractEmailTextBody] Extracted text/plain body (${body.length} chars): ${body.substring(0, 200)}`);
        return body;
      }
    }
    
    console.log('[extractEmailTextBody] No text/plain part found in multipart email');
  } else {
    console.log('[extractEmailTextBody] Not a multipart email (no boundary found)');
  }

  // Fallback for non-multipart emails: skip past the main headers
  const headerEnd = rawEmail.search(/\r?\n\r?\n/);
  if (headerEnd > 0) {
    let body = rawEmail.substring(headerEnd).replace(/^\r?\n\r?\n/, '');
    // Check encoding
    const isQP = /Content-Transfer-Encoding:\s*quoted-printable/i.test(rawEmail.substring(0, headerEnd));
    if (isQP) {
      body = decodeQuotedPrintable(body);
    }
    console.log(`[extractEmailTextBody] Fallback: extracted body after headers (${body.length} chars): ${body.substring(0, 200)}`);
    return body;
  }

  console.log('[extractEmailTextBody] Could not parse email structure, returning raw');
  return rawEmail;
}

/**
 * Extract a security/verification code from a raw email.
 * Greenhouse sends an 8-character alphanumeric code in this format:
 * 
 * Subject: "Security code for your application to [Company]"
 * Body: "Hi [Name],
 *   Copy and paste this code into the security code field on your application:
 *   hIT8Yhs8
 *   After you enter the code, resubmit your application."
 * 
 * IMPORTANT: We extract the body text first to avoid matching random strings
 * in email headers (DKIM signatures, Message-IDs, MIME boundaries, etc.)
 */
function extractSecurityCode(rawEmail: string): string | null {
  if (!rawEmail) return null;

  // Extract just the email body, not headers
  const body = extractEmailTextBody(rawEmail);
  // Also strip HTML tags
  const textBody = body.replace(/<[^>]*>/g, ' ');

  console.log(`[extractSecurityCode] Body length: ${body.length}, first 300 chars: ${body.substring(0, 300).replace(/\r?\n/g, '\\n')}`);

  // PRIMARY: Greenhouse's exact phrase "Copy and paste this code into the security code field on your application:"
  // followed by the code on its own line
  const primaryPatterns = [
    /Copy and paste this code[^]{0,200}?application[:\s]*[\r\n]+\s*([A-Za-z0-9]{6,10})\s*[\r\n]/i,
    /paste this code[^]{0,200}?[\r\n]+\s*([A-Za-z0-9]{6,10})\s*[\r\n]/i,
    /security code field[^]{0,200}?application[:\s]*[\r\n]+\s*([A-Za-z0-9]{6,10})\s*[\r\n]/i,
  ];

  for (let i = 0; i < primaryPatterns.length; i++) {
    const pattern = primaryPatterns[i];
    const match = body.match(pattern);
    if (match?.[1] && !isCommonWord(match[1])) {
      console.log(`[extractSecurityCode] PRIMARY[${i}] matched on body: "${match[1]}"`);
      return match[1];
    }
    // Also try on HTML-stripped version
    const textMatch = textBody.match(pattern);
    if (textMatch?.[1] && !isCommonWord(textMatch[1])) {
      console.log(`[extractSecurityCode] PRIMARY[${i}] matched on textBody: "${textMatch[1]}"`);
      return textMatch[1];
    }
  }

  // SECONDARY: Code between known surrounding phrases in cleaned text
  const secondaryPatterns = [
    // "your application:" followed by code on next line
    /your application[:\s]+[\r\n]+\s*([A-Za-z0-9]{6,10})\s*[\r\n]/i,
    // Code followed by "After you enter the code"
    /[\r\n]\s*([A-Za-z0-9]{6,10})\s*[\r\n][^]*?After you enter the code/i,
    // "application:" then whitespace then code then whitespace then "After"
    /application[:\s]+\s*([A-Za-z0-9]{6,10})\s+After/i,
  ];

  for (let i = 0; i < secondaryPatterns.length; i++) {
    const pattern = secondaryPatterns[i];
    const match = textBody.match(pattern);
    if (match?.[1] && !isCommonWord(match[1])) {
      console.log(`[extractSecurityCode] SECONDARY[${i}] matched: "${match[1]}"`);
      return match[1];
    }
  }

  // TERTIARY: Look for standalone 8-char code near Greenhouse-specific keywords (body only)
  const collapsed = textBody.replace(/\s+/g, ' ');
  const tertiaryPatterns = [
    /security code field[^]{0,300}?([A-Za-z0-9]{8})\b/i,
    /paste this code[^]{0,300}?([A-Za-z0-9]{8})\b/i,
    /enter the code[^]{0,200}?\b([A-Za-z0-9]{8})\b/i,
  ];

  for (let i = 0; i < tertiaryPatterns.length; i++) {
    const pattern = tertiaryPatterns[i];
    const match = collapsed.match(pattern);
    if (match?.[1] && /[A-Za-z]/.test(match[1]) && /\d/.test(match[1]) && !isCommonWord(match[1])) {
      console.log(`[extractSecurityCode] TERTIARY[${i}] matched: "${match[1]}"`);
      return match[1];
    }
  }

  console.log('[extractSecurityCode] No code found in email body');
  return null;
}

function isCommonWord(code: string): boolean {
  const commonWords = [
    'password', 'username', 'security', 'required', 'optional', 'verified',
    'complete', 'continue', 'resubmit', 'received', 'entering', 'applying',
    'attached', 'template', 'position', 'location', 'compa', 'question',
  ];
  return commonWords.includes(code.toLowerCase());
}

/**
 * Poll the user's email inbox for a Greenhouse verification code.
 * Searches recent emails from Greenhouse and extracts the security code.
 * 
 * @param config IMAP connection settings
 * @param maxAttempts Maximum number of polling attempts (default 10)
 * @param pollIntervalMs Time between polls in ms (default 5000)
 * @returns The security code if found, null otherwise
 */
export async function fetchGreenhouseSecurityCode(
  config: ImapConfig,
  maxAttempts: number = 10,
  pollIntervalMs: number = 5000
): Promise<string | null> {
  console.log(`Checking email ${config.email} for Greenhouse security code...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Email check attempt ${attempt}/${maxAttempts}`);

    let client: ImapFlow | null = null;
    try {
      client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.tls !== false, // Default to TLS
        auth: {
          user: config.email,
          pass: config.password,
        },
        logger: false, // Suppress verbose IMAP logging
      });

      await client.connect();

      // Open INBOX
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Strategy: check the last 10 most recent emails for Greenhouse security codes
        // Collect them all, then process NEWEST FIRST to get the latest code
        const status = await client.status('INBOX', { messages: true });
        const totalMessages = status.messages || 0;
        if (totalMessages > 0) {
          const startSeq = Math.max(1, totalMessages - 9);
          const range = `${startSeq}:${totalMessages}`;

          console.log(`Checking emails ${range} (total: ${totalMessages})`);

          // Collect all matching emails, then sort by seq DESC (newest first)
          const candidates: { seq: number; source: string; subject: string }[] = [];

          for await (const msg of client.fetch(range, {
            envelope: true,
            source: true,
          })) {
            if (msg.source) {
              const emailText = msg.source.toString();
              const emailLower = emailText.toLowerCase();
              const subject = (msg.envelope?.subject || '');

              // Check if this email is from Greenhouse or contains security/verification keywords
              const fromGreenhouse = emailLower.includes('greenhouse');
              const hasSecurityKeywords = (
                emailLower.includes('security code') ||
                emailLower.includes('verification code') ||
                emailLower.includes('verify your') ||
                emailLower.includes('copy and paste this code')
              );
              const subjectMatch = (
                subject.toLowerCase().includes('security code') ||
                subject.toLowerCase().includes('verification')
              );

              if (fromGreenhouse || hasSecurityKeywords || subjectMatch) {
                console.log(`Candidate email #${msg.seq}: "${subject}"`);
                candidates.push({ seq: msg.seq, source: emailText, subject });
              }
            }
          }

          // Process newest first
          candidates.sort((a, b) => b.seq - a.seq);
          console.log(`Found ${candidates.length} candidate emails, processing newest first`);

          for (const candidate of candidates) {
            const code = extractSecurityCode(candidate.source);
            if (code) {
              console.log(`Found security code: ${code} (from email #${candidate.seq}, subject: "${candidate.subject}")`);
              return code;
            }
          }
        }
        console.log('No Greenhouse security code found in recent emails');
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      console.error(`IMAP error on attempt ${attempt}:`, err?.message || err);
    } finally {
      if (client) {
        try { await client.logout(); } catch { /* ignore */ }
      }
    }

    // Wait before next poll
    if (attempt < maxAttempts) {
      console.log(`No code found yet, waiting ${pollIntervalMs / 1000}s before next check...`);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  console.log('Failed to find Greenhouse security code after all attempts');
  return null;
}

/**
 * Test IMAP connection to verify credentials work.
 */
export async function testImapConnection(config: ImapConfig): Promise<{ success: boolean; error?: string }> {
  let client: ImapFlow | null = null;
  try {
    client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.tls !== false,
      auth: {
        user: config.email,
        pass: config.password,
      },
      logger: false,
    });

    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to connect to IMAP server',
    };
  } finally {
    if (client) {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }
}
