/**
 * Preset Greenhouse boards for Auto pilot + batch Apply.
 * One row per board token; duplicates and non-board URLs (case studies, external career sites) omitted.
 */

export type PresetBoardUrlHost = 'job-boards' | 'boards';

export interface PresetBoard {
  id: string;
  name: string;
  url: string;
  category: string;
  /** Which Greenhouse host the canonical URL uses (both work with extractBoardToken). */
  urlHost: PresetBoardUrlHost;
}

function boardUrl(id: string, host: PresetBoardUrlHost): string {
  return host === 'job-boards'
    ? `https://job-boards.greenhouse.io/${id}`
    : `https://boards.greenhouse.io/${id}`;
}

/** Deduped curated list: id = Greenhouse board token */
const PRESET_BOARD_DATA: Omit<PresetBoard, 'url'>[] = [
  { id: 'affirm', name: 'Affirm', category: 'FinTech / BNPL', urlHost: 'job-boards' },
  { id: 'airbnb', name: 'Airbnb', category: 'Travel / Homesharing', urlHost: 'boards' },
  { id: 'amplitude', name: 'Amplitude', category: 'Product Analytics', urlHost: 'job-boards' },
  { id: 'anthropic', name: 'Anthropic', category: 'Artificial Intelligence', urlHost: 'job-boards' },
  { id: 'apex', name: 'Apex Eye', category: 'Healthcare / Ophthalmology', urlHost: 'job-boards' },
  { id: 'applovin', name: 'AppLovin', category: 'Mobile Marketing', urlHost: 'boards' },
  { id: 'betterment', name: 'Betterment', category: 'FinTech / Wealth Management', urlHost: 'boards' },
  { id: 'braze', name: 'Braze', category: 'Customer Engagement', urlHost: 'job-boards' },
  { id: 'brex', name: 'Brex', category: 'FinTech / Corporate Cards', urlHost: 'boards' },
  { id: 'calendly', name: 'Calendly', category: 'Scheduling / Productivity', urlHost: 'job-boards' },
  { id: 'calm', name: 'Calm', category: 'Mental Health / Wellness', urlHost: 'job-boards' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'CDN / Security', urlHost: 'boards' },
  { id: 'cockroachlabs', name: 'Cockroach Labs', category: 'Database', urlHost: 'boards' },
  { id: 'coursera', name: 'Coursera', category: 'EdTech / MOOCs', urlHost: 'job-boards' },
  { id: 'creditkarma', name: 'Credit Karma', category: 'FinTech / Personal Finance', urlHost: 'boards' },
  { id: 'dashlane', name: 'Dashlane', category: 'Password Management', urlHost: 'job-boards' },
  { id: 'datadog', name: 'Datadog', category: 'Observability / Monitoring', urlHost: 'boards' },
  { id: 'databricks', name: 'Databricks', category: 'Data / AI Platform', urlHost: 'boards' },
  { id: 'duolingo', name: 'Duolingo', category: 'EdTech / Language', urlHost: 'boards' },
  { id: 'elastic', name: 'Elastic', category: 'Search / Observability', urlHost: 'boards' },
  { id: 'fastly', name: 'Fastly', category: 'CDN / Edge', urlHost: 'boards' },
  { id: 'figma', name: 'Figma', category: 'Design / Collaboration', urlHost: 'boards' },
  { id: 'fivetran', name: 'Fivetran', category: 'Data Integration', urlHost: 'boards' },
  { id: 'flexport', name: 'Flexport', category: 'Logistics / Supply Chain', urlHost: 'boards' },
  { id: 'gitlab', name: 'GitLab', category: 'DevOps / Version Control', urlHost: 'job-boards' },
  { id: 'glassdoor', name: 'Glassdoor', category: 'HR Tech', urlHost: 'job-boards' },
  { id: 'honeycomb', name: 'Honeycomb.io', category: 'Observability', urlHost: 'job-boards' },
  { id: 'indeed', name: 'Indeed', category: 'HR Tech', urlHost: 'job-boards' },
  { id: 'intercom', name: 'Intercom', category: 'Customer Communication', urlHost: 'job-boards' },
  { id: 'janestreet', name: 'Jane Street', category: 'Finance / Trading', urlHost: 'job-boards' },
  { id: 'khanacademy', name: 'Khan Academy', category: 'EdTech / Nonprofit', urlHost: 'job-boards' },
  { id: 'launchdarkly', name: 'LaunchDarkly', category: 'Feature Management', urlHost: 'job-boards' },
  { id: 'lastpass', name: 'LastPass', category: 'Password Management', urlHost: 'job-boards' },
  { id: 'lyft', name: 'Lyft', category: 'Ridesharing / Transportation', urlHost: 'boards' },
  { id: 'melio', name: 'Melio', category: 'FinTech / B2B Payments', urlHost: 'job-boards' },
  { id: 'mercury', name: 'Mercury', category: 'FinTech / Banking', urlHost: 'job-boards' },
  { id: 'mixpanel', name: 'Mixpanel', category: 'Product Analytics', urlHost: 'job-boards' },
  { id: 'myfitnesspal', name: 'MyFitnessPal', category: 'Health / Fitness', urlHost: 'job-boards' },
  { id: 'newrelic', name: 'New Relic', category: 'Observability / Monitoring', urlHost: 'job-boards' },
  { id: 'okta', name: 'Okta', category: 'Identity / Security', urlHost: 'boards' },
  { id: 'opendoor', name: 'Opendoor', category: 'Real Estate / PropTech', urlHost: 'boards' },
  { id: 'opentable', name: 'OpenTable', category: 'Restaurant Tech', urlHost: 'job-boards' },
  { id: 'optiver', name: 'Optiver', category: 'Finance / Trading', urlHost: 'boards' },
  { id: 'papaya', name: 'Papaya', category: 'FinTech / Bill Pay', urlHost: 'job-boards' },
  { id: 'postman', name: 'Postman', category: 'API Development', urlHost: 'job-boards' },
  { id: 'robinhood', name: 'Robinhood', category: 'FinTech / Investing', urlHost: 'boards' },
  { id: 'roku', name: 'Roku', category: 'Streaming / Media', urlHost: 'job-boards' },
  { id: 'squarespace', name: 'Squarespace', category: 'Website Builder', urlHost: 'boards' },
  { id: 'starburst', name: 'Starburst', category: 'Data / Analytics', urlHost: 'job-boards' },
  { id: 'stripe', name: 'Stripe', category: 'FinTech / Payments', urlHost: 'boards' },
  { id: 'twilio', name: 'Twilio', category: 'Cloud Communications', urlHost: 'job-boards' },
  { id: 'upstart', name: 'Upstart', category: 'FinTech / Lending', urlHost: 'boards' },
  { id: 'warp', name: 'Warp', category: 'Developer Tools', urlHost: 'job-boards' },
  { id: 'workato', name: 'Workato', category: 'Automation / iPaaS', urlHost: 'job-boards' },
  { id: 'ziprecruiter', name: 'ZipRecruiter', category: 'HR Tech', urlHost: 'job-boards' },
];

export const PRESET_BOARDS: PresetBoard[] = PRESET_BOARD_DATA.map((b) => ({
  ...b,
  url: boardUrl(b.id, b.urlHost),
})).sort((a, b) => a.name.localeCompare(b.name));

export type PresetBoardId = (typeof PRESET_BOARDS)[number]['id'];

export function getPresetBoardById(id: string): PresetBoard | undefined {
  return PRESET_BOARDS.find((b) => b.id === id);
}

/** Category → boards (sorted by name) for grouped UI */
export function getPresetBoardsGrouped(): Map<string, PresetBoard[]> {
  const map = new Map<string, PresetBoard[]>();
  for (const b of PRESET_BOARDS) {
    const list = map.get(b.category) ?? [];
    list.push(b);
    map.set(b.category, list);
  }
  for (const list of map.values()) {
    list.sort((a, c) => a.name.localeCompare(c.name));
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
