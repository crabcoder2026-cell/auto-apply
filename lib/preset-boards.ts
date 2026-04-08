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
  /* Added from curated boards list (deduped by token) */
  { id: 'airtable', name: 'Airtable', category: 'Productivity / Data', urlHost: 'boards' },
  { id: 'bitmex', name: 'BitMEX', category: 'Crypto / Trading', urlHost: 'boards' },
  { id: 'bombas', name: 'Bombas', category: 'Retail / Apparel', urlHost: 'boards' },
  { id: 'cerebral', name: 'Cerebral', category: 'Mental Health', urlHost: 'boards' },
  { id: 'civisanalytics', name: 'Civis Analytics', category: 'Data / Analytics', urlHost: 'boards' },
  { id: 'cobaltio', name: 'Cobalt', category: 'Security', urlHost: 'boards' },
  { id: 'dailyharvest', name: 'Daily Harvest', category: 'Food / Wellness', urlHost: 'boards' },
  { id: 'datagrail', name: 'DataGrail', category: 'Privacy / Data', urlHost: 'boards' },
  { id: 'dfinity', name: 'DFINITY', category: 'Web3 / Infrastructure', urlHost: 'boards' },
  { id: 'digit', name: 'Digit', category: 'FinTech', urlHost: 'boards' },
  { id: 'doitintl', name: 'DoiT', category: 'Cloud Services', urlHost: 'boards' },
  { id: 'everlane', name: 'Everlane', category: 'Retail / Fashion', urlHost: 'boards' },
  { id: 'fluxx', name: 'Fluxx', category: 'FinTech', urlHost: 'boards' },
  { id: 'gumgum', name: 'GumGum', category: 'Ad Tech', urlHost: 'boards' },
  { id: 'legion', name: 'Legion', category: 'Workforce Tech', urlHost: 'boards' },
  { id: 'lumahealth', name: 'Luma Health', category: 'Healthcare IT', urlHost: 'boards' },
  { id: 'monzo', name: 'Monzo', category: 'FinTech / Banking', urlHost: 'boards' },
  { id: 'morty', name: 'Morty', category: 'Real Estate', urlHost: 'boards' },
  { id: 'mythicalgames', name: 'Mythical Games', category: 'Gaming', urlHost: 'boards' },
  { id: 'omadahealth', name: 'Omada Health', category: 'Healthcare', urlHost: 'boards' },
  { id: 'outsetmedical', name: 'Outset Medical', category: 'Medical Devices', urlHost: 'boards' },
  { id: 'pathstream', name: 'Pathstream', category: 'EdTech', urlHost: 'boards' },
  { id: 'pilothq', name: 'Pilot', category: 'FinTech / Accounting', urlHost: 'boards' },
  { id: 'poshmark', name: 'Poshmark', category: 'E-commerce / Marketplace', urlHost: 'boards' },
  { id: 'propel', name: 'Propel', category: 'FinTech', urlHost: 'boards' },
  { id: 'quip', name: 'Quip', category: 'Productivity', urlHost: 'boards' },
  { id: 'skylotechnologies', name: 'Skylo', category: 'IoT / Satellite', urlHost: 'boards' },
  { id: 'thefarmersdog', name: "The Farmer's Dog", category: 'Pet / Consumer', urlHost: 'boards' },
  { id: 'tia', name: 'Tia', category: "Women's Health", urlHost: 'boards' },
  { id: 'tomorrowhealth', name: 'Tomorrow Health', category: 'Healthcare', urlHost: 'boards' },
  { id: 'trove', name: 'Trove', category: 'FinTech', urlHost: 'boards' },
  { id: 'tubitv', name: 'Tubi', category: 'Streaming / Media', urlHost: 'boards' },
  { id: 'twistbioscience', name: 'Twist Bioscience', category: 'Biotech', urlHost: 'boards' },
  { id: 'udacity', name: 'Udacity', category: 'EdTech', urlHost: 'boards' },
  { id: 'xmotorsai', name: 'X Motors AI', category: 'Automotive / AI', urlHost: 'boards' },
  { id: 'yext', name: 'Yext', category: 'Marketing / Local', urlHost: 'boards' },
  { id: 'yipitdata', name: 'YipitData', category: 'Data / Analytics', urlHost: 'boards' },
  { id: 'zero', name: 'Zero', category: 'FinTech', urlHost: 'boards' },
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
