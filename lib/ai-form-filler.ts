/**
 * AI-powered form field filler.
 * Takes a list of unfilled form fields + user profile context,
 * asks the LLM to generate appropriate answers, and returns them.
 *
 * OpenAI (default): set OPENAI_API_KEY (or LLM_API_KEY) and optional LLM_MODEL.
 * Also supports any OpenAI-compatible API via LLM_API_BASE_URL + LLM_API_KEY.
 * ABACUSAI_API_KEY is accepted as a legacy alias for LLM_API_KEY.
 */

interface FormField {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
}

interface UserContext {
  fullName: string;
  email: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  coverLetter?: string | null;
  workAuthStatus?: string | null;
  yearsExperience?: number | null;
  currentLocation?: string | null;
  country?: string | null;
  jobTitle?: string;
  companyName?: string;
  jobLocation?: string;
}

export interface AIFieldAnswer {
  label: string;
  answer: string;
  id?: string;
  name?: string;
}

function getLlmEnv() {
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.ABACUSAI_API_KEY;
  const baseRaw =
    process.env.LLM_API_BASE_URL || 'https://api.openai.com/v1';
  const baseUrl = baseRaw.replace(/\/$/, '');
  const model =
    process.env.LLM_MODEL ||
    (baseUrl.includes('abacus.ai') ? 'gpt-4.1-mini' : 'gpt-4o-mini');
  return { apiKey, baseUrl, model };
}

function parseJsonFromMessageContent(content: string): unknown {
  let text = content.trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  if (fence) text = fence[1].trim();
  return JSON.parse(text);
}

function normalizeFieldLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\*\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ADDRESS_DECLINE_PHRASE = 'I do not wish to answer';

function isMailingOrPhysicalAddressQuestion(label: string): boolean {
  const n = normalizeFieldLabel(label);
  if (!n) return false;
  return (
    /full\s+physical\s+mailing\s+address/.test(n) ||
    /physical\s+mailing\s+address/.test(n) ||
    /mailing\s+address/.test(n) ||
    /full\s+address/.test(n) ||
    /street.*city.*state/.test(n) ||
    /home\s+address/.test(n) ||
    /residential\s+address/.test(n) ||
    /where\s+to\s+send/.test(n) ||
    /complete\s+address/.test(n) ||
    (/\baddress\b/.test(n) &&
      (/\bline\s*1\b/.test(n) ||
        /\bstreet\b/.test(n) ||
        /\bapt\b/.test(n) ||
        /\bzip\b/.test(n) ||
        /\bpostal\b/.test(n)))
  );
}

function heuristicFallbackForField(f: FormField): string {
  if (f.type === 'select' && f.options && f.options.length > 0) {
    const nonPlaceholder = f.options.find(
      (o) =>
        o.trim() &&
        !/^select|^choose|^please|^pick|^--$/i.test(o.trim()) &&
        !/^-$/.test(o.trim())
    );
    return nonPlaceholder || f.options[0];
  }
  if (
    (f.type === 'radio' || f.type === 'checkbox') &&
    f.options &&
    f.options.length > 0
  ) {
    const yes = f.options.find((o) =>
      /^(yes|y|true|agree|accept|i agree)/i.test(o.trim())
    );
    if (yes) return yes;
    return f.options[0];
  }
  /** Free-text: required fields must not stay empty */
  if (f.type === 'textarea' || f.type === 'text') {
    if (isMailingOrPhysicalAddressQuestion(f.label)) return ADDRESS_DECLINE_PHRASE;
    return 'N/A';
  }
  return 'Yes';
}

/**
 * Merge LLM answers with the field list; fill gaps with best-effort heuristics
 * so every mandatory field gets a value.
 */
function mergeAnswersWithFieldsAndHeuristics(
  fields: FormField[],
  rawAnswers: unknown
): AIFieldAnswer[] {
  const byIndex = new Map<number, string>();
  const arr = Array.isArray(rawAnswers) ? rawAnswers : [];

  type Raw = { field_index?: number; answer?: string; label?: string };
  for (const ans of arr as Raw[]) {
    const a = ans.answer != null ? String(ans.answer).trim() : '';
    if (!a) continue;
    const fieldIndex = (ans.field_index ?? 0) - 1;
    if (fieldIndex >= 0 && fieldIndex < fields.length) {
      byIndex.set(fieldIndex, a);
    }
  }

  // Second pass: map by label when indices are wrong or missing (common with long forms)
  for (let i = 0; i < fields.length; i++) {
    if (byIndex.get(i)?.trim()) continue;
    const want = normalizeFieldLabel(fields[i].label);
    if (!want) continue;
    for (const ans of arr as Raw[]) {
      const a = ans.answer != null ? String(ans.answer).trim() : '';
      if (!a || !ans.label) continue;
      const got = normalizeFieldLabel(ans.label);
      if (!got) continue;
      if (
        got === want ||
        want.includes(got) ||
        got.includes(want) ||
        want.slice(0, 40) === got.slice(0, 40)
      ) {
        byIndex.set(i, a);
        break;
      }
    }
  }

  const out: AIFieldAnswer[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    let ans = byIndex.get(i);
    if (!ans || !ans.trim()) {
      ans = heuristicFallbackForField(f);
    }
    const trimmed = (ans || '').trim();
    const na = /^n\/a$/i.test(trimmed);
    if (
      na &&
      (f.type === 'select' || f.type === 'radio' || f.type === 'checkbox')
    ) {
      ans = heuristicFallbackForField(f);
    } else if (
      (f.type === 'textarea' || f.type === 'text') &&
      isMailingOrPhysicalAddressQuestion(f.label)
    ) {
      ans = ADDRESS_DECLINE_PHRASE;
    }
    if (!ans || !ans.trim()) continue;
    out.push({
      label: f.label,
      answer: ans.trim(),
      id: f.id,
      name: f.name,
    });
  }
  return out;
}

/**
 * Call the LLM API to generate answers for unfilled form fields.
 */
export async function generateFieldAnswers(
  fields: FormField[],
  userContext: UserContext
): Promise<AIFieldAnswer[]> {
  if (fields.length === 0) return [];

  const { apiKey, baseUrl, model } = getLlmEnv();
  if (!apiKey) {
    console.error(
      'OPENAI_API_KEY or LLM_API_KEY not set; AI form filling is disabled'
    );
    return [];
  }

  const fieldsDescription = fields
    .map((f, i) => {
      let desc = `${i + 1}. Label: "${f.label}" (type: ${f.type}${f.required ? ', REQUIRED' : ''})`;
      if (f.options && f.options.length > 0) {
        desc += `\n   Options: ${JSON.stringify(f.options)}`;
      } else if (f.type === 'select') {
        desc += `\n   (Searchable dropdown - type the value to search and select)`;
      }
      if (f.placeholder) {
        desc += `\n   Placeholder: "${f.placeholder}"`;
      }
      return desc;
    })
    .join('\n');

  const userProfile = [
    `Full Name: ${userContext.fullName}`,
    `Email: ${userContext.email}`,
    userContext.phone ? `Phone: ${userContext.phone}` : null,
    userContext.linkedinUrl ? `LinkedIn: ${userContext.linkedinUrl}` : null,
    userContext.portfolioUrl ? `Portfolio/Website: ${userContext.portfolioUrl}` : null,
    userContext.workAuthStatus
      ? `Work Authorization: ${userContext.workAuthStatus}`
      : null,
    userContext.yearsExperience != null
      ? `Years of Experience: ${userContext.yearsExperience}`
      : null,
    userContext.currentLocation
      ? `Location/City: ${userContext.currentLocation}`
      : null,
    userContext.country ? `Country: ${userContext.country}` : null,
    userContext.coverLetter
      ? `Cover Letter Summary: ${userContext.coverLetter.substring(0, 500)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const jobContext = [
    userContext.jobTitle ? `Job Title: ${userContext.jobTitle}` : null,
    userContext.companyName ? `Company: ${userContext.companyName}` : null,
    userContext.jobLocation ? `Job Location: ${userContext.jobLocation}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const phoneRule = userContext.phone
    ? `For PHONE NUMBER fields: Use this phone number from the profile: ${userContext.phone}.`
    : `For PHONE NUMBER fields: Use a plausible professional phone number in a standard format for the applicant's region.`;

  const systemPrompt = `You are an AI assistant that helps fill out job application forms. Your goal is to maximize the applicant's chances of getting an interview. You will be given a list of MANDATORY form fields that need to be filled out, along with the applicant's profile and the job they're applying for.

CRITICAL RULES:
- You MUST return exactly one JSON entry in "answers" for EVERY numbered field (field_index 1 through ${fields.length}). Never omit an index. Never use null or empty string for "answer".
- For select/dropdown fields, you MUST pick EXACTLY one of the provided options when options are listed. Return the option text EXACTLY as shown - character for character. If the list says "(Searchable dropdown)" and no static options were captured, infer the best short answer that would match a typical menu entry (e.g. "Yes", "United States", a job title, or a skill). Do NOT use "N/A" for select/radio/checkbox.
- For YES/NO dropdown or radio questions: ALWAYS pick "Yes" unless it would be dishonest based on the applicant's profile (e.g., if they need sponsorship, don't say "Yes" to "Are you authorized to work without sponsorship").
- For COUNTRY CODE fields (phone country code, dialing code): Always pick "United States (+1)" or the option containing "United States" and "+1". If the exact text differs, pick whichever option includes both "United States" and "+1".
- ${phoneRule}
- For COUNTRY fields (country of residence, nationality): Pick the option that matches the applicant's country from their profile.
- For MAILING ADDRESS / PHYSICAL ADDRESS questions (e.g. "Full physical mailing address", "Street, City and State", "home address", "where to send mail", "complete address", "residential address"): For free-text fields, answer EXACTLY this phrase with no changes: I do not wish to answer. Do not paste the applicant's real address for these. If the field is a dropdown and that exact text is not an option, pick the closest option such as "Prefer not to answer" or "Decline to answer" if available; otherwise N/A is not allowed for selects—pick the most neutral non-specific option.
- For radio/checkbox fields with options, pick the most interview-friendly option text exactly as shown.
- For other TEXT and TEXTAREA (free-text) fields: Use the applicant profile when possible (e.g. city/location for non-mailing questions; experience questions → short honest answer grounded in profile). If the profile does NOT contain the information and you cannot answer truthfully, you MUST still submit the literal text N/A (not blank). Never skip these fields.
- If a field asks about salary expectations, say "Open to discussion" or "Competitive" or pick a reasonable option.
- If a field asks about willingness to relocate, commute, travel, start date, etc., answer positively (Yes, Immediately, Flexible, etc.) when honest.
- For fields about how they heard about the position, say "Job Board" or "Company Website" or pick the first reasonable option.
- For gender/demographics/EEO questions: select "Decline to self-identify" or "Prefer not to say" if available. If not available, pick any option.
- For disability or veteran status: select "Decline" or "Prefer not to answer" if available.
- When in doubt on any dropdown, pick "Yes" if it's an option, otherwise pick the first non-placeholder option.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  const userPrompt = `Here is the applicant's profile:
${userProfile}

${jobContext ? `Job being applied for:\n${jobContext}\n\n` : ''}The following form fields need to be filled out:
${fieldsDescription}

Please provide answers for each field. You MUST include exactly ${fields.length} objects in "answers", with field_index 1 through ${fields.length} in order. Each object may also include "label" (copy the field label text) to help validation.

Example shape:
{
  "answers": [
    { "field_index": 1, "label": "...", "answer": "..." },
    { "field_index": 2, "label": "...", "answer": "..." }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  const orgId = process.env.OPENAI_ORG_ID;
  if (orgId && baseUrl.includes('openai.com')) {
    headers['OpenAI-Organization'] = orgId;
  }

  const callApi = (extra: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 6000,
        temperature: 0.3,
        ...extra,
      }),
    });

  try {
    let response = await callApi({ response_format: { type: 'json_object' } });

    if (!response.ok) {
      const errText = await response.text();
      const maybeUnsupportedFormat =
        response.status === 400 &&
        (errText.toLowerCase().includes('response_format') ||
          errText.toLowerCase().includes('json_object'));
      if (maybeUnsupportedFormat) {
        response = await callApi({});
      } else {
        console.error('AI API error:', response.status, errText);
        return [];
      }
    }

    if (!response.ok) {
      console.error('AI API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No AI response content');
      return [];
    }

    let parsed: { answers?: unknown };
    try {
      parsed = parseJsonFromMessageContent(content) as { answers?: unknown };
    } catch (parseErr) {
      console.error('Failed to parse AI JSON:', parseErr);
      return [];
    }

    const merged = mergeAnswersWithFieldsAndHeuristics(fields, parsed.answers);
    console.log(
      `AI generated answers for ${merged.length}/${fields.length} fields (after merge/heuristics)`
    );
    return merged;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error calling AI for form filling:', msg);
    return [];
  }
}
