/**
 * AI-powered form field filler.
 * Takes a list of unfilled form fields + user profile context,
 * asks the LLM to generate appropriate answers, and returns them.
 */

interface FormField {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options?: string[];  // for select/radio
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

/**
 * Call the LLM API to generate answers for unfilled form fields.
 */
export async function generateFieldAnswers(
  fields: FormField[],
  userContext: UserContext
): Promise<AIFieldAnswer[]> {
  if (fields.length === 0) return [];

  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) {
    console.error('ABACUSAI_API_KEY not set, cannot use AI form filling');
    return [];
  }

  // Build a prompt describing the fields
  const fieldsDescription = fields.map((f, i) => {
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
  }).join('\n');

  const userProfile = [
    `Full Name: ${userContext.fullName}`,
    `Email: ${userContext.email}`,
    userContext.phone ? `Phone: ${userContext.phone}` : null,
    userContext.linkedinUrl ? `LinkedIn: ${userContext.linkedinUrl}` : null,
    userContext.portfolioUrl ? `Portfolio/Website: ${userContext.portfolioUrl}` : null,
    userContext.workAuthStatus ? `Work Authorization: ${userContext.workAuthStatus}` : null,
    userContext.yearsExperience != null ? `Years of Experience: ${userContext.yearsExperience}` : null,
    userContext.currentLocation ? `Location/City: ${userContext.currentLocation}` : null,
    userContext.country ? `Country: ${userContext.country}` : null,
    userContext.coverLetter ? `Cover Letter Summary: ${userContext.coverLetter.substring(0, 500)}` : null,
  ].filter(Boolean).join('\n');

  const jobContext = [
    userContext.jobTitle ? `Job Title: ${userContext.jobTitle}` : null,
    userContext.companyName ? `Company: ${userContext.companyName}` : null,
    userContext.jobLocation ? `Job Location: ${userContext.jobLocation}` : null,
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are an AI assistant that helps fill out job application forms. Your goal is to maximize the applicant's chances of getting an interview. You will be given a list of MANDATORY form fields that need to be filled out, along with the applicant's profile and the job they're applying for.

CRITICAL RULES:
- For select/dropdown fields, you MUST pick EXACTLY one of the provided options. Return the option text EXACTLY as shown - character for character.
- For YES/NO dropdown or radio questions: ALWAYS pick "Yes" unless it would be dishonest based on the applicant's profile (e.g., if they need sponsorship, don't say "Yes" to "Are you authorized to work without sponsorship").
- For COUNTRY CODE fields (phone country code, dialing code): Always pick "United States (+1)" or the option containing "United States" and "+1". If the exact text differs, pick whichever option includes both "United States" and "+1".
- For PHONE NUMBER fields: Always use "6262151213" as the phone number.
- For COUNTRY fields (country of residence, nationality): Pick the option that matches the applicant's country from their profile.
- For radio/checkbox fields with options, pick the most interview-friendly option text exactly as shown.
- For text fields, provide a concise, professional answer that makes the applicant look strong.
- For textarea fields, provide an enthusiastic, well-written response (2-4 sentences max) that highlights fit for the role.
- If a field asks about salary expectations, say "Open to discussion" or "Competitive" or pick a reasonable option.
- If a field asks about willingness to relocate, commute, travel, start date, etc., answer positively (Yes, Immediately, Flexible, etc.).
- For fields about how they heard about the position, say "Job Board" or "Company Website" or pick the first reasonable option.
- For gender/demographics/EEO questions: select "Decline to self-identify" or "Prefer not to say" if available. If not available, pick any option.
- For disability or veteran status: select "Decline" or "Prefer not to answer" if available.
- NEVER return "N/A" or empty answers. Always provide a real answer for every field. If unsure, make a reasonable professional choice.
- When in doubt on any dropdown, pick "Yes" if it's an option, otherwise pick the first non-placeholder option.

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  const userPrompt = `Here is the applicant's profile:
${userProfile}

${jobContext ? `Job being applied for:\n${jobContext}\n\n` : ''}The following form fields need to be filled out:
${fieldsDescription}

Please provide answers for each field. Respond in this JSON format:
{
  "answers": [
    {
      "field_index": 1,
      "answer": "your answer here"
    }
  ]
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

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

    const parsed = JSON.parse(content);
    const answers: AIFieldAnswer[] = [];

    if (parsed.answers && Array.isArray(parsed.answers)) {
      for (const ans of parsed.answers) {
        const fieldIndex = ans.field_index - 1; // convert 1-based to 0-based
        if (fieldIndex >= 0 && fieldIndex < fields.length && ans.answer) {
          const field = fields[fieldIndex];
          answers.push({
            label: field.label,
            answer: String(ans.answer),
            id: field.id,
            name: field.name,
          });
        }
      }
    }

    console.log(`AI generated answers for ${answers.length}/${fields.length} fields`);
    return answers;
  } catch (error: any) {
    console.error('Error calling AI for form filling:', error?.message || error);
    return [];
  }
}
