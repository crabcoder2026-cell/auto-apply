import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { getResumeForAutomation } from './storage';
import { generateFieldAnswers, AIFieldAnswer } from './ai-form-filler';
import { fetchGreenhouseSecurityCode, ImapConfig } from './email-checker';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface ApplicationTemplate {
  resumePath: string | null;
  resumeFileName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  workAuthStatus: string | null;
  yearsExperience: number | null;
  currentLocation: string | null;
  additionalFields?: any;
}

interface JobInfo {
  jobTitle: string;
  companyName: string;
  location: string;
  department: string;
}

export interface FilledField {
  field: string;
  value: string;
  source: 'template' | 'ai';
}

export interface ApplicationResult {
  success: boolean;
  jobInfo: JobInfo;
  status: 'success' | 'failed' | 'requires_manual' | 'skipped';
  errorMessage?: string;
  filledFields?: FilledField[];
  securityCode?: string;
  /** Set for batch applies so history can store the per-job link */
  jobUrl?: string;
}

/**
 * Try common install locations when CHROME_PATH is unset (local dev).
 */
function detectSystemChromePath(): string | null {
  const candidates: string[] = [];
  const { platform } = process;

  if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    );
  } else if (platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 =
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(
        programFilesX86,
        'Google',
        'Chrome',
        'Application',
        'chrome.exe'
      ),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe')
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Local: CHROME_PATH / PUPPETEER_EXECUTABLE_PATH, or auto-detect Chrome in default paths.
 * Serverless: set USE_SPARTICUZ_CHROMIUM=true or run on AWS Lambda (AWS_LAMBDA_FUNCTION_NAME).
 */
export async function launchBrowser(): Promise<Browser> {
  const fromEnv =
    process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  const localChrome = fromEnv || detectSystemChromePath();

  if (localChrome) {
    if (!fromEnv) {
      console.log(`[Puppeteer] Using Chrome at: ${localChrome}`);
    }
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-sandbox',
      ],
      defaultViewport: { width: 1280, height: 800 },
    });
  }

  const useSparticuz =
    process.env.USE_SPARTICUZ_CHROMIUM === 'true' ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!useSparticuz) {
    throw new Error(
      'Could not find Chrome. Install Google Chrome, or set CHROME_PATH (or PUPPETEER_EXECUTABLE_PATH) ' +
        'to your Chrome/Chromium binary. On macOS with Chrome in /Applications, it is usually detected automatically. ' +
        'Alternatively set USE_SPARTICUZ_CHROMIUM=true for serverless Chromium.'
    );
  }

  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
    defaultViewport: (chromium as any).defaultViewport || { width: 1280, height: 800 },
    executablePath,
    headless: (chromium as any).headless ?? true,
  });
}

/**
 * Download a file from a URL to a temporary local path for form upload
 */
async function downloadToTempFile(
  url: string,
  fileName: string
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `resume_${Date.now()}_${fileName}`);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  } catch (error) {
    console.error('Error downloading file to temp:', error);
    return null;
  }
}

/**
 * Clean up a temporary file
 */
function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up temp file:', error);
  }
}

/**
 * Extract job info from the Greenhouse job page
 */
async function extractJobInfo(page: Page): Promise<JobInfo> {
  try {
    return await page.evaluate(() => {
      // Greenhouse job pages have specific selectors
      const titleEl =
        document.querySelector('.app-title') ||
        document.querySelector('h1.heading') ||
        document.querySelector('h1') ||
        document.querySelector('[class*="job-title"]');

      const companyEl =
        document.querySelector('.company-name') ||
        document.querySelector('[class*="company"]');

      const locationEl =
        document.querySelector('.location') ||
        document.querySelector('[class*="location"]');

      const departmentEl =
        document.querySelector('.department') ||
        document.querySelector('[class*="department"]');

      return {
        jobTitle: titleEl?.textContent?.trim() || 'Unknown',
        companyName: companyEl?.textContent?.trim() || 'Unknown',
        location: locationEl?.textContent?.trim() || 'Unknown',
        department: departmentEl?.textContent?.trim() || 'Unknown',
      };
    });
  } catch {
    return {
      jobTitle: 'Unknown',
      companyName: 'Unknown',
      location: 'Unknown',
      department: 'Unknown',
    };
  }
}

/**
 * Also fetch job info from the public API for more reliability
 */
async function fetchJobInfoFromApi(
  boardToken: string,
  jobId: string
): Promise<JobInfo | null> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      jobTitle: data.title || 'Unknown',
      companyName: boardToken,
      location: data.location?.name || 'Unknown',
      department: data.departments?.[0]?.name || 'Unknown',
    };
  } catch {
    return null;
  }
}

/**
 * Parse a Greenhouse URL to extract board token and job ID
 */
function parseGreenhouseUrl(
  url: string
): { boardToken: string; jobId: string } | null {
  const standardPatterns = [
    /boards\.greenhouse\.io\/([\w-]+)\/jobs\/(\d+)/,
    /job-boards\.greenhouse\.io\/ts\/([\w-]+)\/jobs\/(\d+)/,
    /** e.g. https://job-boards.greenhouse.io/acme/jobs/12345 */
    /job-boards\.greenhouse\.io\/(?!ts\/)([\w-]+)\/jobs\/(\d+)/,
  ];
  for (const pattern of standardPatterns) {
    const match = url.match(pattern);
    if (match) return { boardToken: match[1], jobId: match[2] };
  }
  const embedForFirst = url.match(
    /boards\.greenhouse\.io\/embed\/job_app\?[^#]*for=([\w-]+)[^#]*token=(\d+)/i
  );
  if (embedForFirst) {
    return { boardToken: embedForFirst[1], jobId: embedForFirst[2] };
  }
  const embedTokenFirst = url.match(
    /boards\.greenhouse\.io\/embed\/job_app\?[^#]*token=(\d+)[^#]*for=([\w-]+)/i
  );
  if (embedTokenFirst) {
    return { boardToken: embedTokenFirst[2], jobId: embedTokenFirst[1] };
  }
  return null;
}

/** Accept any careers / job page URL; automation still requires an on-page Greenhouse form or embed. */
export function isValidJobPageUrl(url: string): boolean {
  try {
    const u = new URL(String(url).trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** True if the main document already shows a Greenhouse-style application form (not only an empty embed iframe). */
async function mainFrameHasGreenhouseApplicationForm(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return !!(
      document.querySelector('#application_form') ||
      document.querySelector('form#application_form') ||
      document.querySelector('form[action*="greenhouse"]') ||
      document.querySelector('#first_name') ||
      document.querySelector('input[name="first_name"]') ||
      document.querySelector('input[autocomplete="given-name"]')
    );
  });
}

/**
 * Find a navigable Greenhouse job / application URL embedded on a third-party careers page.
 */
async function discoverGreenhouseApplicationUrl(page: Page): Promise<string | null> {
  const current = page.url();
  if (parseGreenhouseUrl(current)) return current;

  const collected = await page.evaluate(() => {
    const out: string[] = [];
    const add = (raw: string | null | undefined) => {
      if (!raw || !raw.trim()) return;
      if (!/greenhouse|grnhse/i.test(raw)) return;
      try {
        const abs = new URL(raw, window.location.href).href;
        out.push(abs);
      } catch {
        /* ignore */
      }
    };
    document
      .querySelectorAll(
        'iframe[src*="greenhouse"], iframe[src*="grnhse"], iframe[id*="grnhse"]'
      )
      .forEach((el) => add((el as HTMLIFrameElement).src));
    document
      .querySelectorAll('a[href*="greenhouse.io"], a[href*="grnhse"]')
      .forEach((el) => add((el as HTMLAnchorElement).href));
    const canon = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    add(canon?.href);
    return [...new Set(out)];
  });

  for (const href of collected) {
    if (parseGreenhouseUrl(href)) return href;
    if (/greenhouse\.io\/.+\/jobs\/\d+/i.test(href)) return href;
  }

  const html = await page.content();
  const regexes = [
    /https?:\/\/(?:www\.)?boards\.greenhouse\.io\/[\w-]+\/jobs\/\d+/gi,
    /https?:\/\/job-boards\.greenhouse\.io\/ts\/[\w-]+\/jobs\/\d+/gi,
    /https?:\/\/job-boards\.greenhouse\.io\/[\w-]+\/jobs\/\d+/gi,
    /https?:\/\/boards\.greenhouse\.io\/embed\/job_app\?[^"'>\s]+/gi,
  ];
  for (const re of regexes) {
    const m = re.exec(html);
    if (m?.[0]) return m[0];
  }

  return null;
}

/**
 * Check if the page has a VISIBLE, blocking CAPTCHA.
 * Greenhouse loads reCAPTCHA scripts on most pages as a hidden spam-protection
 * measure — those invisible challenges should NOT block automation.
 * We only flag a CAPTCHA when it is actually visible and requires user interaction.
 */
async function checkForCaptcha(page: Page): Promise<boolean> {
  try {
    const hasCaptcha = await page.evaluate(() => {
      // Helper: check if an element is truly visible (non-zero size, not hidden)
      function isVisible(el: Element): boolean {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
      }

      // Check for visible reCAPTCHA / hCaptcha iframes
      const captchaIframes = document.querySelectorAll(
        'iframe[src*="recaptcha/api2/anchor"], iframe[src*="recaptcha/api2/bframe"], iframe[src*="hcaptcha.com/captcha"]'
      );
      for (const iframe of captchaIframes) {
        if (isVisible(iframe)) return true;
      }

      // Check for a visible g-recaptcha widget that is NOT invisible recaptcha
      const gRecaptchas = document.querySelectorAll('.g-recaptcha');
      for (const el of gRecaptchas) {
        const sitekey = el.getAttribute('data-sitekey');
        const size = el.getAttribute('data-size');
        // "invisible" recaptcha is non-blocking — skip it
        if (size === 'invisible') continue;
        if (isVisible(el)) return true;
      }

      // Check for visible hCaptcha widget
      const hCaptchas = document.querySelectorAll('.h-captcha');
      for (const el of hCaptchas) {
        const size = el.getAttribute('data-size');
        if (size === 'invisible') continue;
        if (isVisible(el)) return true;
      }

      return false;
    });
    return hasCaptcha;
  } catch {
    return false;
  }
}

/**
 * Type into an input field found by selector, clearing it first
 */
async function typeIntoField(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (!el) return false;
    await el.click({ clickCount: 3 }); // Select all existing text
    await el.type(value, { delay: 30 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fill a React Select combobox dropdown (Greenhouse uses these instead of native <select>).
 * Pattern: click input → clear → type search term → wait for menu → click matching option.
 */
async function fillReactSelect(
  page: Page,
  selector: string,
  value: string
): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (!el) return false;

    // Check if this is actually a React Select combobox
    const isCombobox = await el.evaluate((e) =>
      e.getAttribute('role') === 'combobox' || e.classList.contains('select__input')
    );
    if (!isCombobox) return false;

    await page.evaluate((s) => {
      const n = document.querySelector(s);
      n?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }, selector);

    // Open dropdown first (click to focus), then type to filter — required for React Select
    await el.click();
    await new Promise((r) => setTimeout(r, 350));

    // Clear any existing text
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await new Promise((r) => setTimeout(r, 200));

    // Type the search value character by character to trigger React Select filtering
    await el.type(value, { delay: 50 });
    await new Promise((r) => setTimeout(r, 800));

    // Wait for the dropdown menu to appear
    try {
      await page.waitForSelector('.select__menu, .select__menu-list, .select__option', {
        timeout: 2800,
      });
    } catch {
      await page.keyboard.press('ArrowDown');
      await new Promise((r) => setTimeout(r, 550));
    }

    // Try to click the best matching option
    const clicked = await page.evaluate((val) => {
      const options = document.querySelectorAll('.select__option');
      if (options.length === 0) return false;

      const valLower = val.toLowerCase().trim();

      // Exact text match
      for (const opt of Array.from(options)) {
        if ((opt.textContent || '').toLowerCase().trim() === valLower) {
          (opt as HTMLElement).click();
          return true;
        }
      }
      // Partial match
      for (const opt of Array.from(options)) {
        const optText = (opt.textContent || '').toLowerCase().trim();
        if (optText.includes(valLower) || valLower.includes(optText)) {
          (opt as HTMLElement).click();
          return true;
        }
      }
      // Word-level match
      for (const opt of Array.from(options)) {
        const optText = (opt.textContent || '').toLowerCase().trim();
        const words = valLower.split(/\s+/);
        if (words.some((w) => w.length > 2 && optText.includes(w))) {
          (opt as HTMLElement).click();
          return true;
        }
      }
      // Fallback: click first non-empty option
      for (const opt of Array.from(options)) {
        const text = (opt.textContent || '').trim();
        if (text) {
          (opt as HTMLElement).click();
          return true;
        }
      }
      return false;
    }, value);

    if (!clicked) {
      // Try pressing Enter to select the highlighted option
      await page.keyboard.press('Enter');
    }

    await new Promise((r) => setTimeout(r, 300));

    // Verify selection was made by checking if a value element appeared
    const hasValue = await page.evaluate((sel) => {
      const input = document.querySelector(sel) as HTMLElement;
      if (!input) return false;
      const container = input.closest('.select__container, .select, .select-shell');
      if (!container) return false;
      const singleValue = container.querySelector('.select__single-value');
      return !!(singleValue && singleValue.textContent?.trim());
    }, selector);

    console.log(`React Select "${selector}" fill ${hasValue ? 'succeeded' : 'might have failed'} with "${value}"`);
    return hasValue;
  } catch (err: any) {
    console.error(`Failed to fill React Select "${selector}":`, err?.message || err);
    return false;
  }
}

/**
 * Select a dropdown option by trying to match value or text (native <select> fallback)
 */
async function selectDropdown(
  page: Page,
  selector: string,
  searchTerm: string
): Promise<boolean> {
  try {
    const el = await page.$(selector);
    if (!el) return false;

    const result = await page.evaluate(
      (sel, term) => {
        const select = document.querySelector(sel) as HTMLSelectElement;
        if (!select) return false;

        const termLower = term.toLowerCase();
        const options = Array.from(select.options);

        // Try exact match first
        let match = options.find(
          (o) => o.text.toLowerCase() === termLower || o.value.toLowerCase() === termLower
        );

        // Then partial match
        if (!match) {
          match = options.find(
            (o) =>
              o.text.toLowerCase().includes(termLower) ||
              termLower.includes(o.text.toLowerCase())
          );
        }

        // For yes/no authorization questions
        if (!match) {
          if (
            termLower.includes('citizen') ||
            termLower.includes('green card') ||
            termLower === 'yes'
          ) {
            match = options.find((o) => o.text.toLowerCase().includes('yes'));
          } else if (
            termLower.includes('sponsorship') ||
            termLower.includes('visa')
          ) {
            match = options.find((o) => o.text.toLowerCase().includes('no'));
          }
        }

        if (match) {
          select.value = match.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        return false;
      },
      selector,
      searchTerm
    );

    return result;
  } catch {
    return false;
  }
}

/**
 * Fill out the Greenhouse application form using the browser
 */
async function fillApplicationForm(
  page: Page,
  template: ApplicationTemplate,
  resumeTmpPath: string | null
): Promise<FilledField[]> {
  const filledFields: FilledField[] = [];

  // Split name
  const nameParts = template.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

  // --- Fill basic fields ---
  // First name
  const filledFirst = await typeIntoField(page, '#first_name', firstName) ||
    (await typeIntoField(page, 'input[name="first_name"]', firstName)) ||
    (await typeIntoField(page, 'input[autocomplete="given-name"]', firstName));
  if (filledFirst) filledFields.push({ field: 'First Name', value: firstName, source: 'template' });

  // Last name
  const filledLast = await typeIntoField(page, '#last_name', lastName) ||
    (await typeIntoField(page, 'input[name="last_name"]', lastName)) ||
    (await typeIntoField(page, 'input[autocomplete="family-name"]', lastName));
  if (filledLast) filledFields.push({ field: 'Last Name', value: lastName, source: 'template' });

  // Email
  const filledEmail = await typeIntoField(page, '#email', template.email) ||
    (await typeIntoField(page, 'input[name="email"]', template.email)) ||
    (await typeIntoField(page, 'input[type="email"]', template.email));
  if (filledEmail) filledFields.push({ field: 'Email', value: template.email, source: 'template' });

  const phoneNumber = template.phone?.trim() || '';
  if (phoneNumber) {
    const filledPhone = await typeIntoField(page, '#phone', phoneNumber) ||
      (await typeIntoField(page, 'input[name="phone"]', phoneNumber)) ||
      (await typeIntoField(page, 'input[type="tel"]', phoneNumber));
    if (filledPhone) filledFields.push({ field: 'Phone', value: phoneNumber, source: 'template' });
  }

  // Location - try React Select combobox first (Greenhouse uses #candidate-location), then regular input
  if (template.currentLocation) {
    const filledLocRS = await fillReactSelect(page, '#candidate-location', template.currentLocation);
    if (filledLocRS) {
      filledFields.push({ field: 'Location (City)', value: template.currentLocation, source: 'template' });
    } else {
      const filledLoc = await typeIntoField(page, '#candidate-location', template.currentLocation) ||
        (await typeIntoField(page, '#location', template.currentLocation)) ||
        (await typeIntoField(page, 'input[name="location"]', template.currentLocation));
      if (filledLoc) filledFields.push({ field: 'Location', value: template.currentLocation, source: 'template' });
    }
  }

  // Country - Greenhouse uses React Select combobox with id="country"
  const countryValue = (template.additionalFields as Record<string, string | undefined>)?.country || 'United States';
  const filledCountryRS = await fillReactSelect(page, '#country', countryValue);
  if (filledCountryRS) {
    filledFields.push({ field: 'Country', value: countryValue, source: 'template' });
  }

  // --- Handle resume file upload ---
  if (resumeTmpPath) {
    try {
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        // Upload to the first file input (typically the resume field)
        await fileInputs[0].uploadFile(resumeTmpPath);
        console.log('Resume uploaded successfully');
        filledFields.push({ field: 'Resume', value: template.resumeFileName || 'resume.pdf', source: 'template' });
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error('Error uploading resume:', err);
    }
  }

  // --- Fill additional fields using label matching ---
  const labelFilledFields: Array<{field: string; value: string}> = await page.evaluate(
    (data) => {
      const _labelFilled: Array<{field: string; value: string}> = [];
      // Helper to set value on input/textarea and dispatch events
      function setFieldValue(el: HTMLElement, value: string) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
          (el as HTMLInputElement).value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Helper to select best match from dropdown options
      function selectBestOption(select: HTMLSelectElement, searchTerm: string): boolean {
        const termLower = searchTerm.toLowerCase();
        const options = Array.from(select.options);

        // Exact match
        let match = options.find((o) => o.text.toLowerCase().trim() === termLower);
        // Partial match
        if (!match) match = options.find((o) =>
          o.text.toLowerCase().includes(termLower) || termLower.includes(o.text.toLowerCase().trim())
        );

        if (match) {
          select.value = match.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }

      // Helper to find the input element associated with a label
      function findInputForLabel(label: Element): HTMLElement | null {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el) return el;
        }
        // Check inside label
        let input = label.querySelector('input, textarea, select') as HTMLElement | null;
        if (input) return input;
        // Check next sibling
        let sibling = label.nextElementSibling as HTMLElement | null;
        if (sibling) {
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(sibling.tagName)) return sibling;
          // Check inside sibling container (common with Greenhouse)
          input = sibling.querySelector('input, textarea, select') as HTMLElement | null;
          if (input) return input;
        }
        // Check parent's next child
        const parent = label.parentElement;
        if (parent) {
          const allInputs = parent.querySelectorAll('input, textarea, select');
          if (allInputs.length === 1) return allInputs[0] as HTMLElement;
        }
        return null;
      }

      const allLabels = document.querySelectorAll('label');
      const filledFields = new Set<HTMLElement>(); // Track filled fields to avoid double-filling

      allLabels.forEach((label) => {
        const text = (label.textContent || '').toLowerCase().trim();
        const input = findInputForLabel(label);

        if (!input || filledFields.has(input)) return;

        const tagName = input.tagName.toLowerCase();
        const inputType = input.getAttribute('type') || '';

        // Skip file inputs and submit buttons
        if (inputType === 'file' || inputType === 'submit' || inputType === 'hidden') return;

        // --- LinkedIn Profile ---
        if (
          (text.includes('linkedin') || text.includes('linked in')) &&
          data.linkedinUrl
        ) {
          setFieldValue(input, data.linkedinUrl);
          filledFields.add(input);
          _labelFilled.push({ field: 'LinkedIn Profile', value: data.linkedinUrl });
        }

        // --- Portfolio / Website ---
        else if (
          (text.includes('portfolio') || text.includes('website') ||
           text.includes('personal site') || text.includes('github') ||
           text.includes('personal url') || text.includes('web url')) &&
          data.portfolioUrl
        ) {
          setFieldValue(input, data.portfolioUrl);
          filledFields.add(input);
          _labelFilled.push({ field: 'Portfolio/Website', value: data.portfolioUrl });
        }

        // --- Cover letter ---
        else if (text.includes('cover letter') && data.coverLetter) {
          if (tagName === 'textarea') {
            setFieldValue(input, data.coverLetter);
            filledFields.add(input);
            _labelFilled.push({ field: 'Cover Letter', value: data.coverLetter.substring(0, 60) + '...' });
          }
        }

        // --- Location (City) ---
        else if (
          (text.includes('location') || text.includes('city') ||
           (text.includes('where') && text.includes('based'))) &&
          !text.includes('country') &&
          data.currentLocation
        ) {
          if (tagName === 'input' || tagName === 'textarea') {
            setFieldValue(input, data.currentLocation);
            filledFields.add(input);
            _labelFilled.push({ field: 'Location (City)', value: data.currentLocation });
          }
        }

        // --- Country Code (phone dialing code like "United States +1") ---
        else if (
          (text.includes('country') && (text.includes('code') || text.includes('phone') || text.includes('dial'))) ||
          (text.includes('country') && tagName === 'select' && (() => {
            // Check if options contain phone codes (e.g., "+1", "+44")
            const opts = Array.from((input as HTMLSelectElement).options);
            return opts.some((o) => /\+\d/.test(o.text));
          })())
        ) {
          if (tagName === 'select') {
            const select = input as HTMLSelectElement;
            const options = Array.from(select.options);
            // Pick "United States (+1)" or any option with "United States" and "+1"
            let match = options.find((o) => o.text.includes('United States') && o.text.includes('+1'));
            if (!match) match = options.find((o) => o.text.includes('US') && o.text.includes('+1'));
            if (!match) match = options.find((o) => o.text.includes('+1'));
            if (match) {
              select.value = match.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              filledFields.add(input);
              _labelFilled.push({ field: 'Country Code', value: 'United States (+1)' });
            }
          }
        }

        // --- Country / Country of Residence ---
        else if (
          (text.includes('country') || text.includes('nation')) &&
          data.country
        ) {
          if (tagName === 'select') {
            const select = input as HTMLSelectElement;
            const options = Array.from(select.options);

            // First check if this is actually a country code dropdown (has +1, +44 etc.)
            const isPhoneCodeDropdown = options.some((o) => /\+\d/.test(o.text));
            if (isPhoneCodeDropdown) {
              // Select United States +1
              let match = options.find((o) => o.text.includes('United States') && o.text.includes('+1'));
              if (!match) match = options.find((o) => o.text.includes('+1'));
              if (match) {
                select.value = match.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                filledFields.add(input);
                _labelFilled.push({ field: 'Country Code', value: 'United States (+1)' });
              }
            } else {
              // Regular country dropdown
              const countryLower = data.country.toLowerCase();
              let match = options.find((o) => o.text.toLowerCase().trim() === countryLower);
              if (!match) match = options.find((o) =>
                o.text.toLowerCase().includes(countryLower) || countryLower.includes(o.text.toLowerCase().trim())
              );

              // Country aliases
              if (!match) {
                const aliases: Record<string, string[]> = {
                  'united states': ['us', 'usa', 'united states of america', 'u.s.', 'u.s.a.'],
                  'united kingdom': ['uk', 'great britain', 'gb', 'england'],
                  'south korea': ['korea, republic of', 'republic of korea', 'korea'],
                  'united arab emirates': ['uae'],
                };
                const myAliases = aliases[countryLower] || [];
                for (const alias of myAliases) {
                  match = options.find((o) =>
                    o.text.toLowerCase().includes(alias) || alias.includes(o.text.toLowerCase().trim())
                  );
                  if (match) break;
                }
                if (!match) {
                  for (const [key, aliasList] of Object.entries(aliases)) {
                    if (aliasList.includes(countryLower)) {
                      match = options.find((o) => o.text.toLowerCase().includes(key));
                      if (match) break;
                    }
                  }
                }
              }

              if (match) {
                select.value = match.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                filledFields.add(input);
                _labelFilled.push({ field: 'Country', value: data.country });
              }
            }
          } else if (tagName === 'input') {
            setFieldValue(input, data.country);
            filledFields.add(input);
            _labelFilled.push({ field: 'Country', value: data.country });
          }
        }

        // --- Work authorization ---
        else if (
          (text.includes('authorized') || text.includes('authorization') ||
           text.includes('legally') || text.includes('sponsorship') ||
           text.includes('work eligib') || text.includes('right to work') ||
           text.includes('require sponsorship') || text.includes('visa status')) &&
          data.workAuthStatus
        ) {
          if (tagName === 'select') {
            const select = input as HTMLSelectElement;
            const termLower = data.workAuthStatus.toLowerCase();
            const options = Array.from(select.options);
            let match =
              options.find((o) => o.text.toLowerCase().includes(termLower)) ||
              options.find((o) => termLower.includes(o.text.toLowerCase().trim()));
            if (!match && (termLower.includes('citizen') || termLower.includes('green card'))) {
              match = options.find((o) => o.text.toLowerCase().includes('yes'));
            }
            if (!match && (termLower.includes('sponsorship') || termLower.includes('visa'))) {
              match = options.find((o) => o.text.toLowerCase().includes('no'));
            }
            if (match) {
              select.value = match.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              filledFields.add(input);
              _labelFilled.push({ field: 'Work Authorization', value: match.text });
            }
          } else if (tagName === 'input') {
            setFieldValue(input, data.workAuthStatus);
            filledFields.add(input);
            _labelFilled.push({ field: 'Work Authorization', value: data.workAuthStatus });
          }
        }

        // --- Years of experience ---
        else if (
          (text.includes('experience') || text.includes('years of')) &&
          data.yearsExperience !== null
        ) {
          if (tagName === 'select') {
            selectBestOption(input as HTMLSelectElement, data.yearsExperience.toString());
            filledFields.add(input);
            _labelFilled.push({ field: 'Years of Experience', value: data.yearsExperience.toString() });
          } else {
            setFieldValue(input, data.yearsExperience.toString());
            filledFields.add(input);
            _labelFilled.push({ field: 'Years of Experience', value: data.yearsExperience.toString() });
          }
        }

        // --- Phone (backup) ---
        else if (
          data.phone &&
          (text.includes('phone') || text.includes('mobile') || text.includes('telephone'))
        ) {
          if (tagName === 'input') {
            setFieldValue(input, data.phone);
            filledFields.add(input);
            _labelFilled.push({ field: 'Phone', value: data.phone });
          }
        }
      });

      // --- Second pass: fill any remaining unfilled required fields ---
      // Some Greenhouse forms use custom question IDs without clear labels
      // Try to find unfilled required selects/inputs and fill them
      const allSelects = document.querySelectorAll('select');
      allSelects.forEach((select) => {
        if (filledFields.has(select as HTMLElement)) return;
        const selectEl = select as HTMLSelectElement;
        const parentText = (select.closest('.field, .field-group, [class*="field"]')?.textContent || '').toLowerCase();
        const labelText = (select.previousElementSibling?.textContent || '').toLowerCase();
        const combinedText = parentText + ' ' + labelText;

        // Country code or Country
        if ((combinedText.includes('country') || combinedText.includes('nation'))) {
          const options = Array.from(selectEl.options);
          const isPhoneCodeDropdown = options.some((o) => /\+\d/.test(o.text));
          if (isPhoneCodeDropdown) {
            // Country code dropdown - select United States +1
            let match = options.find((o) => o.text.includes('United States') && o.text.includes('+1'));
            if (!match) match = options.find((o) => o.text.includes('+1'));
            if (match) {
              selectEl.value = match.value;
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          } else if (data.country) {
            const countryLower = data.country.toLowerCase();
            let match = options.find((o) => o.text.toLowerCase().trim() === countryLower);
            if (!match) match = options.find((o) =>
              o.text.toLowerCase().includes(countryLower) || countryLower.includes(o.text.toLowerCase().trim())
            );
            if (match) {
              selectEl.value = match.value;
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
      });

      return _labelFilled;
    },
    {
      linkedinUrl: template.linkedinUrl,
      portfolioUrl: template.portfolioUrl,
      coverLetter: template.coverLetter,
      workAuthStatus: template.workAuthStatus,
      yearsExperience: template.yearsExperience,
      country: template.additionalFields?.country || null,
      currentLocation: template.currentLocation,
      phone: template.phone,
    }
  );

  // Merge label-filled fields into the result
  for (const lf of labelFilledFields) {
    filledFields.push({ field: lf.field, value: lf.value, source: 'template' });
  }

  // Wait for form to settle
  await new Promise((r) => setTimeout(r, 1500));
  return filledFields;
}

type UnfilledFieldExtraction = {
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  index: number;
};

/** CSS selector for an element id — Node has no `CSS.escape`, so use attribute form. */
function selectorForElementId(id: string): string {
  const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `[id="${escaped}"]`;
}

/**
 * Open each React Select combobox, read option labels, then close (Escape).
 * Gives the LLM exact strings for dropdown answers.
 */
async function enrichReactSelectFieldOptions(
  page: Page,
  fields: UnfilledFieldExtraction[]
): Promise<void> {
  for (const f of fields) {
    if (f.type !== 'select' || (f.options && f.options.length > 0)) continue;
    if (!f.id) continue;
    const sel = selectorForElementId(f.id);
    try {
      await page.evaluate((s) => {
        document.querySelector(s)?.scrollIntoView({
          block: 'center',
          inline: 'nearest',
        });
      }, sel);
      const handle = await page.$(sel);
      if (!handle) continue;
      const isRs = await handle.evaluate((e) =>
        e.getAttribute('role') === 'combobox' ||
        (e as HTMLElement).classList.contains('select__input')
      );
      if (!isRs) continue;

      await handle.click();
      await new Promise((r) => setTimeout(r, 450));
      try {
        await page.waitForSelector('.select__menu .select__option, .select__option', {
          timeout: 2800,
        });
      } catch {
        await page.keyboard.press('ArrowDown');
        await new Promise((r) => setTimeout(r, 400));
      }

      const opts = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('.select__menu .select__option, .select__option')
        )
          .map((o) => (o.textContent || '').trim())
          .filter((t) => t.length > 0)
      );
      if (opts.length > 0) f.options = opts;

      await page.keyboard.press('Escape');
      await new Promise((r) => setTimeout(r, 280));
    } catch (e) {
      console.warn('enrichReactSelectFieldOptions:', f.id, e);
    }
  }
}

/**
 * Extract unfilled required fields from the page for AI filling.
 * Returns structured field info for each empty required field.
 */
async function extractUnfilledFields(page: Page): Promise<UnfilledFieldExtraction[]> {
  return page.evaluate(() => {
    const fields: Array<{
      label: string;
      type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
      options?: string[];
      required: boolean;
      id?: string;
      name?: string;
      placeholder?: string;
      index: number;
    }> = [];

    let fieldIndex = 0;

    // Helper: check if a field is truly required (Greenhouse / custom questions)
    function isFieldRequired(el: HTMLElement, labelText: string): boolean {
      if ((el as HTMLInputElement).required) return true;
      if (el.getAttribute('aria-required') === 'true') return true;
      const descId = el.getAttribute('aria-describedby');
      if (descId) {
        for (const part of descId.split(/\s+/)) {
          const d = document.getElementById(part);
          if (d?.textContent?.toLowerCase().includes('required')) return true;
        }
      }
      if (labelText.includes('*') || labelText.toLowerCase().includes('required')) return true;

      let walk: HTMLElement | null = el;
      for (let depth = 0; depth < 8 && walk; depth++) {
        const cls = (walk.className && String(walk.className)) || '';
        if (/\brequired\b/i.test(cls)) return true;
        if (walk.getAttribute('data-required') === 'true') return true;
        walk = walk.parentElement;
      }

      const fs = el.closest('fieldset');
      if (fs?.querySelector('legend')?.textContent?.includes('*')) return true;

      const parent = el.closest(
        '.field, .field-group, [class*="field"], [class*="question"], .application-form, [class*="application"]'
      );
      if (parent) {
        const requiredBadge = parent.querySelector(
          '.required, [class*="required"], .asterisk, [class*="Required"]'
        );
        if (requiredBadge) return true;
        const parentLabel = parent.querySelector('label');
        if (parentLabel && parentLabel.textContent?.includes('*')) return true;
      }
      return false;
    }

    // Helper: check if a field is empty/unfilled
    function isFieldEmpty(el: HTMLElement): boolean {
      const tag = el.tagName.toLowerCase();
      if (tag === 'select') {
        const sel = el as HTMLSelectElement;
        // Empty if first option is selected and it's a placeholder
        const selectedOpt = sel.options[sel.selectedIndex];
        if (!selectedOpt) return true;
        const text = selectedOpt.text.toLowerCase().trim();
        return sel.selectedIndex === 0 && (
          text === '' || text.includes('select') || text.includes('choose') ||
          text.includes('please') || text === '--' || text === '-'
        );
      }
      if (tag === 'input') {
        const inp = el as HTMLInputElement;
        const type = inp.type.toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          // Check if any in the group is checked
          const name = inp.name;
          if (name) {
            const group = document.querySelectorAll(`input[name="${name}"]`);
            return !Array.from(group).some((g) => (g as HTMLInputElement).checked);
          }
          return !inp.checked;
        }
        return !inp.value.trim();
      }
      if (tag === 'textarea') {
        return !(el as HTMLTextAreaElement).value.trim();
      }
      return true;
    }

    // Helper: find label text for a field (custom questions, React, etc.)
    function findLabelForField(el: HTMLElement): string {
      const id = el.id;
      if (id) {
        try {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (label) return (label.textContent || '').trim();
        } catch {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return (label.textContent || '').trim();
        }
      }
      const wrapLabel = el.closest('label');
      if (wrapLabel && wrapLabel !== el) {
        const inner = wrapLabel.querySelector('input, textarea, select');
        if (inner === el) return (wrapLabel.textContent || '').trim();
      }
      const prev = el.previousElementSibling;
      if (prev && prev.tagName === 'LABEL') return (prev.textContent || '').trim();
      const parent = el.closest(
        '.field, .field-group, [class*="field"], [class*="question"], .form-group'
      );
      if (parent) {
        const label = parent.querySelector('label');
        if (label) return (label.textContent || '').trim();
        const heading = parent.querySelector(
          'h2, h3, h4, h5, .field-label, [class*="label"], [class*="Label"]'
        );
        if (heading) return (heading.textContent || '').trim();
      }
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const parts = labelledBy
          .split(/\s+/)
          .map((lid) => document.getElementById(lid)?.textContent?.trim() || '')
          .filter(Boolean);
        if (parts.length) return parts.join(' ');
      }
      return '';
    }

    function getFallbackLabel(el: HTMLElement): string {
      const al = el.getAttribute('aria-label');
      if (al && al.trim().length > 1) return al.trim();
      const ph = (el as HTMLInputElement).placeholder;
      if (ph && ph.length > 2 && !/^https?:\/\//i.test(ph)) return ph.trim();
      const name = (el as HTMLInputElement).name;
      if (name && name.length > 1) {
        return name
          .replace(/[_-]+/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .trim();
      }
      if (el.id && el.id.length > 1) {
        return el.id.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
      }
      return '';
    }

    // Scan all form inputs, textareas, selects
    const allInputs = document.querySelectorAll('input, textarea, select');
    const processedNames = new Set<string>();
    const processedIds = new Set<string>();

    allInputs.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inputType = (el as HTMLInputElement).type?.toLowerCase() || '';

      // Skip hidden, file, submit, buttons
      if (inputType === 'hidden' || inputType === 'file' || inputType === 'submit' || inputType === 'button') return;
      // Skip invisible fields
      if (!(htmlEl.offsetWidth || htmlEl.offsetHeight)) return;
      // Skip hidden required validation inputs (Greenhouse uses these internally)
      if (htmlEl.className.includes('requiredInput')) return;

      const labelText = findLabelForField(htmlEl);
      const combinedLabel = (labelText || getFallbackLabel(htmlEl)).trim();
      const isRequired = isFieldRequired(htmlEl, combinedLabel);

      // Detect React Select combobox inputs (Greenhouse uses these instead of native <select>)
      const isReactSelect = (
        el.getAttribute('role') === 'combobox' ||
        htmlEl.classList.contains('select__input')
      ) && tag === 'input';

      // For React Select comboboxes, check if empty by looking for selected value
      let isEmpty: boolean;
      if (isReactSelect) {
        const container = htmlEl.closest('.select__container, .select, .select-shell');
        const singleValue = container?.querySelector('.select__single-value');
        isEmpty = !singleValue || !(singleValue.textContent || '').trim();
      } else {
        isEmpty = isFieldEmpty(htmlEl);
      }

      // Only fill mandatory/required fields (marked with *)
      if (!isEmpty) return;
      if (!isRequired) return;
      if (!combinedLabel) return;

      // Avoid duplicates for same id
      if (el.id && processedIds.has(el.id)) return;
      if (el.id) processedIds.add(el.id);

      // For radio/checkbox groups, process only once per name
      if (inputType === 'radio' || inputType === 'checkbox') {
        const name = (el as HTMLInputElement).name;
        if (name && processedNames.has(name)) return;
        if (name) processedNames.add(name);
      }

      let fieldType: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' = 'text';
      let options: string[] | undefined;

      if (isReactSelect) {
        // React Select combobox — mark as 'select' type
        // Note: we can't easily read options without opening the menu,
        // but we can provide a hint that this is a searchable dropdown
        fieldType = 'select';
        options = undefined; // AI will infer from context; options load dynamically
      } else if (tag === 'select') {
        fieldType = 'select';
        const sel = el as HTMLSelectElement;
        options = Array.from(sel.options)
          .map(o => o.text.trim())
          .filter(t => t && !t.toLowerCase().includes('select') && !t.toLowerCase().includes('choose') && t !== '--' && t !== '-');
      } else if (tag === 'textarea') {
        fieldType = 'textarea';
      } else if (inputType === 'radio') {
        fieldType = 'radio';
        const name = (el as HTMLInputElement).name;
        if (name) {
          options = Array.from(document.querySelectorAll(`input[name="${name}"]`))
            .map(r => {
              const rLabel = findLabelForField(r as HTMLElement);
              return rLabel || (r as HTMLInputElement).value;
            })
            .filter(Boolean);
        }
      } else if (inputType === 'checkbox') {
        fieldType = 'checkbox';
      }

      fields.push({
        label: combinedLabel,
        type: fieldType,
        options: options,
        required: isRequired,
        id: el.id || undefined,
        name: (el as HTMLInputElement).name || undefined,
        placeholder: (el as HTMLInputElement).placeholder || undefined,
        index: fieldIndex++,
      });
    });

    return fields;
  });
}

/**
 * Fill fields on the page using AI-generated answers.
 * Uses Puppeteer's native methods (click, type, select) for reliable interaction
 * instead of just setting .value which doesn't trigger React/framework updates.
 * Returns the list of fields that were ACTUALLY filled successfully.
 */
async function fillFieldsWithAIAnswers(page: Page, answers: AIFieldAnswer[]): Promise<FilledField[]> {
  if (answers.length === 0) return [];
  const actuallyFilled: FilledField[] = [];

  for (const answer of answers) {
    if (!answer.answer || answer.answer === 'N/A') continue;

    try {
      // Step 1: Find the target element's selector and type using page.evaluate
      const fieldInfo = await page.evaluate((ans) => {
        function findInputForLabel(label: Element): HTMLElement | null {
          const forId = label.getAttribute('for');
          if (forId) {
            const el = document.getElementById(forId);
            if (el) return el;
          }
          let input = label.querySelector('input, textarea, select') as HTMLElement | null;
          if (input) return input;
          let sibling = label.nextElementSibling as HTMLElement | null;
          if (sibling) {
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(sibling.tagName)) return sibling;
            input = sibling.querySelector('input, textarea, select') as HTMLElement | null;
            if (input) return input;
          }
          const parent = label.parentElement;
          if (parent) {
            const allInputs = parent.querySelectorAll('input, textarea, select');
            if (allInputs.length === 1) return allInputs[0] as HTMLElement;
          }
          return null;
        }

        let targetEl: HTMLElement | null = null;

        // Find by id
        if (ans.id) {
          targetEl = document.getElementById(ans.id);
        }
        // Find by name
        if (!targetEl && ans.name) {
          targetEl = document.querySelector(`[name="${ans.name}"]`) as HTMLElement;
        }
        // Find by label text
        if (!targetEl && ans.label) {
          const labels = document.querySelectorAll('label');
          const cleanLabel = ans.label.replace(/\s*\*\s*$/, '').trim().toLowerCase();
          for (const label of Array.from(labels)) {
            const text = (label.textContent || '').replace(/\s*\*\s*$/, '').trim().toLowerCase();
            if (text === cleanLabel || text.includes(cleanLabel) || cleanLabel.includes(text)) {
              targetEl = findInputForLabel(label);
              if (targetEl) break;
            }
          }
        }

        if (!targetEl) return null;

        const tag = targetEl.tagName.toLowerCase();
        const inputType = (targetEl as HTMLInputElement).type?.toLowerCase() || '';
        const elId = targetEl.id || '';
        const elName = (targetEl as HTMLInputElement).name || '';

        // Detect if this is a React Select combobox (Greenhouse custom dropdown)
        const isReactSelect = (
          targetEl.getAttribute('role') === 'combobox' ||
          targetEl.classList.contains('select__input')
        ) && tag === 'input';

        // Build a unique CSS selector for this element
        let selector = '';
        if (elId) {
          selector = `#${CSS.escape(elId)}`;
        } else if (elName) {
          selector = `${tag}[name="${elName}"]`;
        } else {
          // Generate a unique data attribute for targeting
          const uid = 'ai-fill-' + Math.random().toString(36).substring(2, 10);
          targetEl.setAttribute('data-ai-target', uid);
          selector = `[data-ai-target="${uid}"]`;
        }

        // For native select fields, find the best matching option value
        let optionValue: string | null = null;
        if (tag === 'select' && !isReactSelect) {
          const select = targetEl as HTMLSelectElement;
          const ansLower = ans.answer.toLowerCase().trim();
          const options = Array.from(select.options);
          let match = options.find(o => o.text.toLowerCase().trim() === ansLower);
          if (!match) match = options.find(o =>
            o.text.toLowerCase().includes(ansLower) || ansLower.includes(o.text.toLowerCase().trim())
          );
          if (!match) match = options.find(o => {
            const words = ansLower.split(/\s+/);
            return words.some(w => w.length > 2 && o.text.toLowerCase().includes(w));
          });
          // If no match found, try the first non-placeholder option
          if (!match && options.length > 1) {
            match = options.find(o => {
              const t = o.text.toLowerCase().trim();
              return t && !t.includes('select') && !t.includes('choose') && !t.includes('please') && t !== '--' && t !== '-' && t !== '';
            });
          }
          optionValue = match ? match.value : null;
        }

        // For radio fields, find the matching radio button selector
        let radioSelector: string | null = null;
        if (inputType === 'radio' && elName) {
          const radios = document.querySelectorAll(`input[name="${elName}"]`);
          const ansLower = ans.answer.toLowerCase().trim();
          for (const radio of Array.from(radios)) {
            const rEl = radio as HTMLInputElement;
            const rParentLabel = radio.closest('label');
            const rLabel = rParentLabel ? (rParentLabel.textContent || '').toLowerCase().trim() : '';
            const rValue = rEl.value.toLowerCase().trim();
            let rForLabel = '';
            if (rEl.id) {
              const fl = document.querySelector(`label[for="${rEl.id}"]`);
              if (fl) rForLabel = (fl.textContent || '').toLowerCase().trim();
            }
            if (rLabel.includes(ansLower) || ansLower.includes(rLabel) ||
                rForLabel.includes(ansLower) || ansLower.includes(rForLabel) ||
                rValue === ansLower) {
              if (rEl.id) {
                radioSelector = `#${CSS.escape(rEl.id)}`;
              } else {
                const uid = 'ai-radio-' + Math.random().toString(36).substring(2, 10);
                rEl.setAttribute('data-ai-target', uid);
                radioSelector = `[data-ai-target="${uid}"]`;
              }
              break;
            }
          }
        }

        return {
          selector,
          tag,
          inputType,
          isReactSelect,
          optionValue,
          radioSelector,
        };
      }, answer);

      if (!fieldInfo) {
        console.log(`AI fill: could not find element for field "${answer.label}"`);
        continue;
      }

      const { selector, tag, inputType, isReactSelect, optionValue, radioSelector } = fieldInfo;
      const cleanLabel = answer.label.replace(/\s*\*\s*$/, '').trim();
      const displayValue = answer.answer.length > 80 ? answer.answer.substring(0, 80) + '...' : answer.answer;

      // Step 2: Use appropriate method to fill the field
      if (isReactSelect) {
        // React Select combobox — use type-and-select pattern
        const filled = await fillReactSelect(page, selector, answer.answer);
        if (filled) {
          actuallyFilled.push({ field: cleanLabel, value: displayValue, source: 'ai' });
          console.log(`AI filled React Select "${answer.label}" = "${answer.answer}"`);
        } else {
          console.log(`AI fill: React Select "${answer.label}" failed to select option`);
        }
      } else if (tag === 'select' && optionValue !== null) {
        // Native <select> — focus/click first so custom handlers run, then pick option
        await page.evaluate((s) => {
          const n = document.querySelector(s);
          n?.scrollIntoView({ block: 'center', inline: 'nearest' });
        }, selector);
        await page.click(selector);
        await new Promise((r) => setTimeout(r, 120));
        await page.select(selector, optionValue);
        actuallyFilled.push({ field: cleanLabel, value: displayValue, source: 'ai' });
        console.log(`AI filled select "${answer.label}" = "${answer.answer}"`);
      } else if (inputType === 'radio' && radioSelector) {
        await page.click(radioSelector);
        actuallyFilled.push({ field: cleanLabel, value: displayValue, source: 'ai' });
        console.log(`AI filled radio "${answer.label}" = "${answer.answer}"`);
      } else if (inputType === 'checkbox') {
        const ansLower = answer.answer.toLowerCase();
        if (ansLower === 'yes' || ansLower === 'true' || ansLower === 'checked') {
          await page.click(selector);
          actuallyFilled.push({ field: cleanLabel, value: answer.answer, source: 'ai' });
          console.log(`AI filled checkbox "${answer.label}"`);
        }
      } else if (tag === 'input' || tag === 'textarea') {
        await page.evaluate((s) => {
          const n = document.querySelector(s);
          n?.scrollIntoView({ block: 'center', inline: 'nearest' });
        }, selector);
        await page.click(selector, { clickCount: 3 });
        await page.type(selector, answer.answer);
        actuallyFilled.push({ field: cleanLabel, value: displayValue, source: 'ai' });
        console.log(`AI filled text "${answer.label}" = "${answer.answer}"`);
      }
    } catch (err: any) {
      console.error(`AI fill error for "${answer.label}":`, err?.message || err);
    }
  }

  console.log(`AI actually filled ${actuallyFilled.length}/${answers.length} fields on the page`);
  return actuallyFilled;
}

/**
 * Detect if Greenhouse is showing a security code / email verification screen.
 * This screen appears after form submission when bot detection triggers.
 */
async function detectSecurityCodeScreen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const bodyText = (document.body.textContent || '').toLowerCase();
    // If we already reached a thank-you / confirmation state, do not treat as code screen
    // (avoids false positives from job copy containing words like "verification")
    const successHints = [
      'thank you',
      'thanks for applying',
      'application submitted',
      'received your application',
      'application complete',
      'your application has been submitted',
      'successfully applied',
    ];
    if (successHints.some((h) => bodyText.includes(h))) {
      return false;
    }

    const securityIndicators = [
      'security code',
      'verification code',
      'verify your email',
      'enter the code',
      'code sent to',
      'check your email',
      'email verification',
      'confirm your email',
      'enter code',
    ];
    const hasIndicator = securityIndicators.some((indicator) =>
      bodyText.includes(indicator)
    );
    if (!hasIndicator) return false;

    // Also check for an input field that looks like a code entry
    const codeInputs = document.querySelectorAll(
      'input[type="text"], input[type="number"], input[type="tel"], input:not([type])'
    );
    for (const input of Array.from(codeInputs)) {
      const el = input as HTMLInputElement;
      if (!(el.offsetWidth && el.offsetHeight)) continue;
      const placeholder = (el.placeholder || '').toLowerCase();
      const label = (el.getAttribute('aria-label') || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const nearby = (el.closest('div, form')?.textContent || '').toLowerCase();
      if (
        placeholder.includes('code') || placeholder.includes('verify') ||
        label.includes('code') || label.includes('verify') ||
        name.includes('code') || name.includes('verify') ||
        id.includes('code') || id.includes('verify') ||
        nearby.includes('security code') || nearby.includes('verification code')
      ) {
        return true;
      }
    }

    // Check for multiple single-char inputs (common code entry pattern)
    const singleCharInputs = Array.from(codeInputs).filter((el) => {
      const inp = el as HTMLInputElement;
      return inp.maxLength === 1 && inp.offsetWidth && inp.offsetHeight;
    });
    if (singleCharInputs.length >= 6) return true;

    return false;
  });
}

/**
 * Extract IMAP config from the application template's additionalFields.
 */
function getImapConfigFromTemplate(template: ApplicationTemplate): ImapConfig | null {
  const additional = template.additionalFields || {};
  const imapHost = additional.imapHost;
  const imapPort = additional.imapPort;
  const imapPassword = additional.imapPassword;

  if (!imapHost || !imapPassword) return null;

  return {
    host: imapHost,
    port: imapPort ? parseInt(imapPort, 10) : 993,
    email: template.email,
    password: imapPassword,
    tls: true,
  };
}

/**
 * Handle the security code verification flow:
 * 1. Poll email inbox for the Greenhouse verification code
 * 2. Enter the code into the page using Puppeteer native typing (React-compatible)
 * 3. Click submit to resubmit the application
 * 4. Wait and check for success
 */
async function handleSecurityCodeVerification(
  page: Page,
  imapConfig: ImapConfig
): Promise<{ handled: boolean; code: string | null }> {
  // Poll email for the security code
  const code = await fetchGreenhouseSecurityCode(imapConfig, 12, 5000);
  if (!code) {
    console.log('Could not find security code in email');
    return { handled: false, code: null };
  }

  console.log(`[SecurityCode] Got code: ${code}, now entering into form...`);

  // Take a screenshot of what we see for debugging
  const pageText = await page.evaluate(() => document.body.innerText?.substring(0, 500) || '');
  console.log(`[SecurityCode] Page text preview: ${pageText.replace(/\n/g, ' ').substring(0, 300)}`);

  // Strategy: Use Puppeteer native click + type to enter the code.
  // This is React-compatible because Puppeteer dispatches real DOM events.
  let codeEntered = false;

  // Step 1: Try to find the security code input field
  // Look for single-character input fields first (common code entry pattern)
  const singleCharInputs = await page.$$('input[maxlength="1"]');
  const visibleSingleChars: any[] = [];
  for (const inp of singleCharInputs) {
    const isVisible = await inp.evaluate((el) =>
      !!(el as HTMLElement).offsetWidth && !!(el as HTMLElement).offsetHeight
    );
    if (isVisible) visibleSingleChars.push(inp);
  }

  if (visibleSingleChars.length >= code.length) {
    console.log(`[SecurityCode] Found ${visibleSingleChars.length} single-char inputs, typing one char each...`);
    // Sort by visual position (LTR / top-to-bottom). Greenhouse often uses flex/grid so DOM order ≠ display order.
    const withBoxes = await Promise.all(
      visibleSingleChars.map(async (handle) => {
        const box = await handle.boundingBox();
        return { handle, box };
      })
    );
    withBoxes.sort((a, b) => {
      if (!a.box || !b.box) return 0;
      if (Math.abs(a.box.y - b.box.y) > 10) return a.box.y - b.box.y;
      return a.box.x - b.box.x;
    });
    const sortedHandles = withBoxes.map((x) => x.handle);
    for (let i = 0; i < code.length; i++) {
      await sortedHandles[i].click();
      await sortedHandles[i].type(code[i], { delay: 40 });
      await new Promise((r) => setTimeout(r, 90));
    }
    codeEntered = true;
    console.log('[SecurityCode] Entered code via single-char inputs (visual order)');
    try {
      await sortedHandles[code.length - 1].evaluate((el: Element) =>
        (el as HTMLElement).blur()
      );
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      /* ignore */
    }
  }

  if (!codeEntered) {
    // Look for a single input field that's related to security code entry
    // Use page.evaluate to IDENTIFY the field, then use Puppeteer native typing
    const codeInputIndex = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll(
        'input[type="text"], input[type="number"], input[type="tel"], input:not([type])'
      ));
      
      for (let i = 0; i < allInputs.length; i++) {
        const el = allInputs[i] as HTMLInputElement;
        if (!(el.offsetWidth && el.offsetHeight)) continue;
        
        const placeholder = (el.placeholder || '').toLowerCase();
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        
        // Check the label element associated with this input
        const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
        const labelText = (labelEl?.textContent || '').toLowerCase();
        
        // Check parent/sibling text (limited scope to avoid matching entire form)
        const parentDiv = el.closest('.field, .form-group, .input-group, [class*="field"], [class*="code"]');
        const parentText = parentDiv ? (parentDiv.textContent || '').toLowerCase() : '';

        if (
          placeholder.includes('code') || placeholder.includes('verify') ||
          label.includes('code') || label.includes('verify') ||
          name.includes('code') || name.includes('verify') || name.includes('security') ||
          id.includes('code') || id.includes('verify') || id.includes('security') ||
          labelText.includes('code') || labelText.includes('verify') || labelText.includes('security') ||
          parentText.includes('security code') || parentText.includes('verification code') ||
          parentText.includes('enter the code') || parentText.includes('enter code')
        ) {
          return i;
        }
      }
      return -1;
    });

    if (codeInputIndex >= 0) {
      console.log(`[SecurityCode] Found code input at index ${codeInputIndex}, using Puppeteer native typing...`);
      const allInputs = await page.$$('input[type="text"], input[type="number"], input[type="tel"], input:not([type])');
      const targetInput = allInputs[codeInputIndex];
      if (targetInput) {
        await targetInput.click({ clickCount: 3 }); // Select all existing text
        await new Promise((r) => setTimeout(r, 200));
        await targetInput.type(code, { delay: 50 });
        codeEntered = true;
        console.log('[SecurityCode] Entered code via targeted input with Puppeteer typing');
      }
    }
  }

  if (!codeEntered) {
    // Last resort: find ANY visible text input on the page and type into it
    console.log('[SecurityCode] No specific code input found, trying any visible text input...');
    const allInputs = await page.$$('input[type="text"], input:not([type])');
    for (const inp of allInputs) {
      const isVisible = await inp.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        return !!(htmlEl.offsetWidth && htmlEl.offsetHeight);
      });
      if (isVisible) {
        await inp.click({ clickCount: 3 });
        await new Promise((r) => setTimeout(r, 200));
        await inp.type(code, { delay: 50 });
        codeEntered = true;
        console.log('[SecurityCode] Entered code via first visible text input (fallback)');
        break;
      }
    }
  }

  if (!codeEntered) {
    console.log('[SecurityCode] Failed to find any input field for the security code');
    return { handled: false, code };
  }

  // Wait a moment for any client-side validation (React state)
  await new Promise((r) => setTimeout(r, 1500));

  // Step 2: Click the submit/resubmit button — use Puppeteer click after tagging (more reliable than evaluate.click for React)
  console.log('[SecurityCode] Looking for submit/verify button...');

  const clickedButton = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('button, input[type="submit"], a[role="button"]')
    );

    const priorities = [
      (text: string, value: string) =>
        text.includes('resubmit') || value.includes('resubmit'),
      (text: string, value: string) =>
        text.includes('submit application') || value.includes('submit application'),
      (text: string, value: string) =>
        text.includes('submit your application') || value.includes('submit'),
      (text: string, value: string) =>
        text.includes('verify email') || text.includes('verify code'),
      (text: string, value: string) =>
        text.includes('verify') || value.includes('verify'),
      (text: string, value: string) =>
        text.includes('submit') || value.includes('submit'),
      (text: string, value: string) =>
        text.includes('continue') || value.includes('continue'),
      (text: string, value: string) =>
        text.includes('confirm') || value.includes('confirm'),
    ];

    for (const priority of priorities) {
      for (const btn of buttons) {
        const text = (btn.textContent || '').toLowerCase().trim();
        const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
        if (!priority(text, value)) continue;
        const el = btn as HTMLElement;
        if (!el.offsetWidth || !el.offsetHeight) continue;
        el.setAttribute('data-gh-auto-verify-submit', '1');
        return btn.textContent?.trim() || value || 'unknown';
      }
    }
    return null;
  });

  let verifySubmitClicked = false;
  const submitHandle = await page.$('[data-gh-auto-verify-submit="1"]');
  if (submitHandle) {
    try {
      await submitHandle.click({ delay: 80 });
      verifySubmitClicked = true;
      console.log(
        `[SecurityCode] Clicked button (Puppeteer): "${clickedButton || 'verify-submit'}"`
      );
    } catch (e) {
      console.log('[SecurityCode] Puppeteer click failed, trying DOM click:', e);
      await page.evaluate(() => {
        document.querySelector('[data-gh-auto-verify-submit="1"]')?.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        );
      });
      verifySubmitClicked = true;
    }
    try {
      await submitHandle.evaluate((el) =>
        el.removeAttribute('data-gh-auto-verify-submit')
      );
    } catch {
      /* element may have detached after navigation */
    }
  }

  if (!verifySubmitClicked) {
    console.log('[SecurityCode] No tagged button, trying clickSubmitButton...');
    const submitted = await clickSubmitButton(page);
    if (!submitted) {
      console.log('[SecurityCode] Trying Enter key as last resort...');
      await page.keyboard.press('Enter');
    }
  }

  // Step 3: Wait for network + SPA update (Greenhouse is slow to show thank-you)
  console.log('[SecurityCode] Waiting for submission to process...');
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 25000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4000));

  // Step 4: Check if we succeeded (poll twice — confirmation text can appear late)
  let successAfterCode = await checkSubmissionSuccess(page);
  if (!successAfterCode) {
    await new Promise((r) => setTimeout(r, 5000));
    successAfterCode = await checkSubmissionSuccess(page);
  }
  if (successAfterCode) {
    console.log('[SecurityCode] Application submitted successfully after entering security code!');
    return { handled: true, code };
  }

  // Check if we're still on the security code screen (code might have been wrong)
  const stillOnCodeScreen = await detectSecurityCodeScreen(page);
  if (stillOnCodeScreen) {
    console.log('[SecurityCode] Still on security code screen - code may not have been accepted');
    // Try one more time: maybe the code wasn't properly entered
    // Try clicking submit again
    await clickSubmitButton(page);
    await new Promise((r) => setTimeout(r, 5000));
    
    const retrySuccess = await checkSubmissionSuccess(page);
    if (retrySuccess) {
      console.log('[SecurityCode] Application submitted on retry!');
      return { handled: true, code };
    }
    
    console.log('[SecurityCode] Code entry did not lead to submission');
    return { handled: false, code };
  }

  // Page changed but no clear success indicator - might still be processing
  // Consider it handled since the code was entered and submitted
  const pageUrl = page.url();
  const currentText = await page.evaluate(() => document.body.innerText?.substring(0, 300) || '');
  console.log(`[SecurityCode] Post-submit state - URL: ${pageUrl}, Text: ${currentText.replace(/\n/g, ' ').substring(0, 200)}`);
  
  return { handled: true, code };
}

/**
 * Click the submit/apply button on the form
 */
async function clickSubmitButton(page: Page): Promise<boolean> {
  const selectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'button#submit_app',
    '#submit_app',
    'button[id*="submit"]',
    'input[value*="Submit"]',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
  ];

  for (const selector of selectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        const isVisible = await btn.evaluate(
          (el) =>
            !!(el as HTMLElement).offsetWidth && !!(el as HTMLElement).offsetHeight
        );
        if (isVisible) {
          await btn.click();
          console.log(`Clicked submit button with selector: ${selector}`);
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  // Fallback: try to find any button with submit-like text
  try {
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const submitBtn = buttons.find((b) => {
        const text = (b.textContent || '').toLowerCase();
        const value = (b as HTMLInputElement).value?.toLowerCase() || '';
        return (
          text.includes('submit') ||
          text.includes('apply') ||
          value.includes('submit') ||
          value.includes('apply')
        );
      });
      if (submitBtn) {
        (submitBtn as HTMLElement).click();
        return true;
      }
      return false;
    });
    return clicked;
  } catch {
    return false;
  }
}

/**
 * Check if the application was submitted successfully
 */
async function checkSubmissionSuccess(page: Page): Promise<boolean> {
  try {
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    const successIndicators = [
      'thank you',
      'thanks for applying',
      'thank you for applying',
      'application submitted',
      'successfully applied',
      'application has been received',
      'we have received your application',
      'received your application',
      'application complete',
      'your application has been submitted',
      'we\'ve received your application',
      'you applied',
      'application was submitted',
    ];
    const bodyLower = bodyText.toLowerCase();
    return successIndicators.some((indicator) => bodyLower.includes(indicator));
  } catch {
    return false;
  }
}

/**
 * Navigate to the application form on a Greenhouse job page
 */
async function navigateToApplicationForm(page: Page): Promise<boolean> {
  // Check if we're already on the application form
  const hasForm = await page.evaluate(() => {
    return !!(
      document.querySelector('#application_form') ||
      document.querySelector('form[action*="application"]') ||
      document.querySelector('#first_name') ||
      document.querySelector('input[name="first_name"]')
    );
  });

  if (hasForm) return true;

  // Try clicking the "Apply" button
  const applySelectors = [
    '#apply_button',
    'a[href*="#app"]',
    'a[href*="/apply"]',
    'button:has-text("Apply")',
    'a:has-text("Apply")',
    '[class*="apply-button"]',
    '[id*="apply"]',
  ];

  for (const selector of applySelectors) {
    try {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 2000));
        // Check if form appeared
        const formNow = await page.evaluate(() => {
          return !!(
            document.querySelector('#application_form') ||
            document.querySelector('#first_name') ||
            document.querySelector('input[name="first_name"]')
          );
        });
        if (formNow) return true;
      }
    } catch {
      continue;
    }
  }

  // Try scrolling to the application section
  await page.evaluate(() => {
    const appSection = document.querySelector('#application, #app, #apply');
    if (appSection) {
      appSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Scroll to bottom where the form usually is
      window.scrollTo(0, document.body.scrollHeight);
    }
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Final check
  return page.evaluate(() => {
    return !!(
      document.querySelector('#application_form') ||
      document.querySelector('#first_name') ||
      document.querySelector('input[name="first_name"]') ||
      document.querySelector('form[action*="application"]')
    );
  });
}

/**
 * Apply to a single Greenhouse job using a headless browser
 */
export async function applyToSingleJob(
  jobUrl: string,
  template: ApplicationTemplate
): Promise<ApplicationResult> {
  let browser: Browser | null = null;
  let resumeTmpPath: string | null = null;

  try {
    /** Refined after navigation (redirects / embedded Greenhouse discovery). */
    let parsed = parseGreenhouseUrl(jobUrl);

    // Resolve resume: copy local file or download from signed URL into a temp path (always temp so finally can unlink safely)
    if (template.resumePath) {
      try {
        const source = await getResumeForAutomation(template.resumePath);
        const baseName = template.resumeFileName || 'resume.pdf';
        if (source?.kind === 'path') {
          const tmpDir = os.tmpdir();
          resumeTmpPath = path.join(
            tmpDir,
            `resume_${Date.now()}_${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          );
          fs.copyFileSync(source.path, resumeTmpPath);
        } else if (source?.kind === 'url') {
          resumeTmpPath = await downloadToTempFile(source.url, baseName);
        }
      } catch (error) {
        console.error('Error preparing resume for upload:', error);
      }
    }

    // Launch headless browser
    console.log(`Launching headless browser for: ${jobUrl}`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to the job page (may be a company careers site that embeds Greenhouse)
    console.log('Navigating to job page...');
    await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    let hasGhForm = await mainFrameHasGreenhouseApplicationForm(page);
    if (!hasGhForm) {
      const discovered = await discoverGreenhouseApplicationUrl(page);
      if (discovered) {
        console.log('Opening embedded Greenhouse URL:', discovered);
        await page.goto(discovered, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 2000));
        hasGhForm = await mainFrameHasGreenhouseApplicationForm(page);
      }
    }

    if (!hasGhForm) {
      return {
        success: false,
        jobInfo: {
          jobTitle: 'Unknown',
          companyName: 'Unknown',
          location: 'Unknown',
          department: 'Unknown',
        },
        status: 'requires_manual',
        errorMessage:
          'No Greenhouse application form was found. Use a URL that loads Greenhouse (e.g. a careers page with an embedded board, or a direct boards.greenhouse.io / job-boards.greenhouse.io job link).',
      };
    }

    parsed = parseGreenhouseUrl(page.url()) ?? parsed;

    let apiJobInfo: JobInfo | null = null;
    if (parsed) {
      apiJobInfo = await fetchJobInfoFromApi(parsed.boardToken, parsed.jobId);
    }

    // Extract job info from the page
    const pageJobInfo = await extractJobInfo(page);
    const jobInfo: JobInfo = {
      jobTitle: apiJobInfo?.jobTitle || pageJobInfo.jobTitle,
      companyName: apiJobInfo?.companyName || pageJobInfo.companyName || (parsed?.boardToken ?? 'Unknown'),
      location: apiJobInfo?.location || pageJobInfo.location,
      department: apiJobInfo?.department || pageJobInfo.department,
    };

    // Check for CAPTCHA
    const hasCaptcha = await checkForCaptcha(page);
    if (hasCaptcha) {
      return {
        success: false,
        jobInfo,
        status: 'requires_manual',
        errorMessage:
          'This job application has a CAPTCHA. Please apply manually.',
      };
    }

    // Navigate to the application form
    console.log('Looking for application form...');
    const foundForm = await navigateToApplicationForm(page);
    if (!foundForm) {
      return {
        success: false,
        jobInfo,
        status: 'requires_manual',
        errorMessage:
          'Could not find the application form on this page. The job may use a different application system.',
      };
    }

    // Re-check for CAPTCHA after navigating to form
    const hasCaptchaOnForm = await checkForCaptcha(page);
    if (hasCaptchaOnForm) {
      return {
        success: false,
        jobInfo,
        status: 'requires_manual',
        errorMessage:
          'Application form has a CAPTCHA. Please apply manually.',
      };
    }

    // Step 1: Fill out the application form using template data
    console.log('Filling out application form with template data...');
    const allFilledFields: FilledField[] = await fillApplicationForm(page, template, resumeTmpPath);

    // Step 2: Mandatory custom / remaining fields — AI + dropdown option hydration, with retries
    const userContext = {
      fullName: template.fullName,
      email: template.email,
      phone: template.phone,
      linkedinUrl: template.linkedinUrl,
      portfolioUrl: template.portfolioUrl,
      coverLetter: template.coverLetter,
      workAuthStatus: template.workAuthStatus,
      yearsExperience: template.yearsExperience,
      currentLocation: template.currentLocation,
      country: template.additionalFields?.country || null,
      jobTitle: jobInfo.jobTitle,
      companyName: jobInfo.companyName,
      jobLocation: jobInfo.location,
    };

    const AI_FILL_MAX_PASSES = 3;
    for (let pass = 0; pass < AI_FILL_MAX_PASSES; pass++) {
      console.log(`Checking for unfilled mandatory fields (pass ${pass + 1}/${AI_FILL_MAX_PASSES})...`);
      const unfilledFields = await extractUnfilledFields(page);
      if (unfilledFields.length === 0) {
        if (pass === 0) console.log('All required fields filled by template.');
        break;
      }

      console.log(`Found ${unfilledFields.length} unfilled mandatory field(s), enriching dropdowns + AI...`);
      await enrichReactSelectFieldOptions(page, unfilledFields);

      const aiAnswers = await generateFieldAnswers(unfilledFields, userContext);
      if (aiAnswers.length === 0) {
        console.warn('AI returned no answers; stopping AI fill passes.');
        break;
      }

      console.log(`Applying ${aiAnswers.length} AI answer(s)...`);
      const aiFilledFields = await fillFieldsWithAIAnswers(page, aiAnswers);
      allFilledFields.push(...aiFilledFields);
      await new Promise((r) => setTimeout(r, 1400));
    }

    // Deduplicate filled fields (prefer 'template' source over 'ai' for same field name)
    const fieldMap = new Map<string, FilledField>();
    for (const f of allFilledFields) {
      const key = f.field.toLowerCase();
      const existing = fieldMap.get(key);
      if (!existing || (existing.source === 'ai' && f.source === 'template')) {
        fieldMap.set(key, f);
      }
    }
    const deduplicatedFields = Array.from(fieldMap.values());
    // Replace allFilledFields with deduplicated version
    allFilledFields.length = 0;
    allFilledFields.push(...deduplicatedFields);

    // Click submit
    console.log('Clicking submit button...');
    const submitted = await clickSubmitButton(page);
    if (!submitted) {
      return {
        success: false,
        jobInfo,
        status: 'failed',
        errorMessage: 'Could not find or click the submit button.',
      };
    }

    // Wait for submission to process
    await new Promise((r) => setTimeout(r, 5000));

    // Check if Greenhouse is asking for a security/verification code
    const securityCodeDetected = await detectSecurityCodeScreen(page);
    let retrievedSecurityCode: string | undefined;
    if (securityCodeDetected) {
      console.log('Security code verification detected! Checking email...');
      const imapConfig = getImapConfigFromTemplate(template);
      if (imapConfig) {
        const verifyResult = await handleSecurityCodeVerification(page, imapConfig);
        if (verifyResult.code) {
          retrievedSecurityCode = verifyResult.code;
        }
        if (verifyResult.handled) {
          // handleSecurityCodeVerification already entered code and clicked submit.
          // It also checked for success internally. Check again here as final confirmation.
          console.log('Security code flow completed. Checking final page state...');
          const successAfterVerify = await checkSubmissionSuccess(page);
          if (successAfterVerify) {
            console.log('Application submitted successfully after security code verification!');
            return {
              success: true,
              jobInfo,
              status: 'success',
              filledFields: allFilledFields,
              securityCode: retrievedSecurityCode,
            };
          }
          // Not a clear success but code was entered and submitted - still check below
        } else {
          return {
            success: false,
            jobInfo,
            status: 'requires_manual',
            errorMessage: retrievedSecurityCode
              ? `Greenhouse requires email verification. The security code was found but could not be entered automatically. Please enter the code manually: ${retrievedSecurityCode}`
              : 'Greenhouse requires email verification but could not retrieve the security code from email. Please check your email IMAP settings or apply manually.',
            filledFields: allFilledFields,
            securityCode: retrievedSecurityCode,
          };
        }
      } else {
        return {
          success: false,
          jobInfo,
          status: 'requires_manual',
          errorMessage:
            'Greenhouse requires email verification. Please configure your IMAP email settings in your profile template to enable automatic code entry.',
          filledFields: allFilledFields,
        };
      }
    }

    // Check for success
    const isSuccess = await checkSubmissionSuccess(page);
    if (isSuccess) {
      console.log('Application submitted successfully!');
      return {
        success: true,
        jobInfo,
        status: 'success',
        filledFields: allFilledFields,
        securityCode: retrievedSecurityCode,
      };
    }

    // Check if there are validation errors on the page
    const validationErrors = await page.evaluate(() => {
      const errorEls = document.querySelectorAll(
        '.field-error, .error, [class*="error"], [class*="invalid"]'
      );
      const errors: string[] = [];
      errorEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 200) errors.push(text);
      });
      return errors.filter((e) => e.length > 0).slice(0, 5);
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        jobInfo,
        status: 'failed',
        errorMessage: `Form validation errors: ${validationErrors.join('; ')}`,
        filledFields: allFilledFields,
        securityCode: retrievedSecurityCode,
      };
    }

    // If we can't confirm success but no errors visible, mark as uncertain
    return {
      success: false,
      jobInfo,
      status: 'requires_manual',
      errorMessage: retrievedSecurityCode
        ? `Could not confirm submission. A security code was retrieved from your email: ${retrievedSecurityCode}. You may need to enter it manually on the application page.`
        : 'Could not confirm if the application was submitted. Please verify manually.',
      filledFields: allFilledFields,
      securityCode: retrievedSecurityCode,
    };
  } catch (error: any) {
    console.error('Application error:', error);
    return {
      success: false,
      jobInfo: {
        jobTitle: 'Unknown',
        companyName: 'Unknown',
        location: 'Unknown',
        department: 'Unknown',
      },
      status: 'failed',
      errorMessage: error?.message || 'Unknown error occurred',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (resumeTmpPath) {
      cleanupTempFile(resumeTmpPath);
    }
  }
}

/**
 * Apply to batch jobs from a Greenhouse board
 */
export async function applyToBatchJobs(
  boardUrl: string,
  template: ApplicationTemplate,
  filters?: {
    keywords?: string;
    location?: string;
    department?: string;
  },
  options?: {
    /** Skip jobs already in this set (keys: `${boardToken}:${jobId}`) */
    dedupeKeys?: Set<string>;
    /** Max jobs to apply this run (default 10) */
    maxJobs?: number;
  }
): Promise<ApplicationResult[]> {
  const results: ApplicationResult[] = [];

  try {
    // Extract board token from URL
    const boardToken = extractBoardToken(boardUrl);
    if (!boardToken) {
      return [
        {
          success: false,
          jobInfo: {
            jobTitle: 'Unknown',
            companyName: 'Unknown',
            location: 'Unknown',
            department: 'Unknown',
          },
          status: 'failed',
          errorMessage: 'Invalid Greenhouse board URL',
        },
      ];
    }

    // Fetch jobs from the public API
    const boardData = await fetchBoardJobs(boardToken);
    if (!boardData || !boardData.jobs || boardData.jobs.length === 0) {
      return [
        {
          success: false,
          jobInfo: {
            jobTitle: 'Unknown',
            companyName: boardToken,
            location: 'Unknown',
            department: 'Unknown',
          },
          status: 'failed',
          errorMessage: 'No jobs found on this board',
        },
      ];
    }

    // Apply filters
    let filteredJobs = boardData.jobs;
    if (filters?.keywords) {
      const kw = filters.keywords.toLowerCase();
      filteredJobs = filteredJobs.filter((j) =>
        j.title.toLowerCase().includes(kw)
      );
    }
    if (filters?.location) {
      const loc = filters.location.toLowerCase();
      filteredJobs = filteredJobs.filter((j) =>
        j.location?.name?.toLowerCase().includes(loc)
      );
    }
    if (filters?.department) {
      const dept = filters.department.toLowerCase();
      filteredJobs = filteredJobs.filter((j) =>
        j.departments?.some((d: any) => d.name.toLowerCase().includes(dept))
      );
    }

    if (options?.dedupeKeys && options.dedupeKeys.size > 0) {
      const dedupe = options.dedupeKeys;
      filteredJobs = filteredJobs.filter((j) => {
        const key = `${boardToken}:${j.id}`;
        return !dedupe.has(key);
      });
    }

    const maxJobs = options?.maxJobs ?? 10;
    const limitedJobs = filteredJobs.slice(0, maxJobs);
    console.log(
      `Found ${filteredJobs.length} matching jobs, applying to ${limitedJobs.length}`
    );

    for (const job of limitedJobs) {
      const jobUrl =
        job.absolute_url ||
        `https://boards.greenhouse.io/${boardToken}/jobs/${job.id}`;

      const result = await applyToSingleJob(jobUrl, template);
      result.jobUrl = jobUrl;

      // Override with API data
      result.jobInfo = {
        jobTitle: job.title,
        companyName: boardData.name || boardToken,
        location: job.location?.name || 'Unknown',
        department: job.departments?.[0]?.name || 'Unknown',
      };

      results.push(result);

      // Delay between applications
      await new Promise((r) => setTimeout(r, 3000));
    }

    return results;
  } catch (error: any) {
    console.error('Batch application error:', error);
    if (results.length === 0) {
      results.push({
        success: false,
        jobInfo: {
          jobTitle: 'Unknown',
          companyName: 'Unknown',
          location: 'Unknown',
          department: 'Unknown',
        },
        status: 'failed',
        errorMessage: error?.message || 'Batch application error',
      });
    }
    return results;
  }
}

/**
 * Fetch all jobs from a Greenhouse board via public API
 */
export async function fetchBoardJobs(
  boardToken: string
): Promise<{ jobs: any[]; name: string } | null> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extract board token from URL
 */
export function extractBoardToken(url: string): string | null {
  const patterns = [
    /boards\.greenhouse\.io\/([\w-]+)/,
    /job-boards\.greenhouse\.io\/ts\/([\w-]+)/,
    /** e.g. https://job-boards.greenhouse.io/wppmedia */
    /job-boards\.greenhouse\.io\/(?!ts\/)([\w-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1] !== 'embed') return m[1];
  }
  return null;
}

/**
 * If the user pasted a company careers URL, fetch the page and find an embedded
 * Greenhouse board URL / board token. Returns a URL that extractBoardToken accepts.
 */
export async function resolveGreenhouseBoardInputUrl(
  inputUrl: string
): Promise<string | null> {
  const trimmed = inputUrl.trim();
  if (extractBoardToken(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  const validToken = (t: string | undefined): string | null => {
    if (!t || !/^[\w-]+$/.test(t)) return null;
    if (['embed', 'js', 'v1', 'assets', 'static'].includes(t)) return null;
    return t;
  };

  try {
    const res = await fetch(trimmed, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const tsMatch = html.match(
      /https?:\/\/job-boards\.greenhouse\.io\/ts\/([\w-]+)/i
    );
    const tsTok = validToken(tsMatch?.[1]);
    if (tsTok) return `https://job-boards.greenhouse.io/ts/${tsTok}`;

    const jbMatch = html.match(
      /https?:\/\/job-boards\.greenhouse\.io\/(?!ts\/)([\w-]+)/i
    );
    const jbTok = validToken(jbMatch?.[1]);
    if (jbTok) return `https://job-boards.greenhouse.io/${jbTok}`;

    const boardsMatch = html.match(
      /https?:\/\/(?:www\.)?boards\.greenhouse\.io\/([\w-]+)/i
    );
    const bTok = validToken(boardsMatch?.[1]);
    if (bTok) return `https://boards.greenhouse.io/${bTok}`;

    const embedM = html.match(
      /greenhouse\.io\/embed\/[^"'>\s]+[?&]for=([\w-]+)/i
    );
    const et = validToken(embedM?.[1]);
    if (et) return `https://job-boards.greenhouse.io/${et}`;
  } catch (e) {
    console.warn('resolveGreenhouseBoardInputUrl:', e);
  }

  return null;
}
