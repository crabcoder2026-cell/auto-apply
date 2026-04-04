/**
 * Curated Greenhouse boards for Auto Search (job discovery).
 * One row per unique board token; duplicates from job-boards vs boards URLs merged.
 *
 * Excluded (not scrapeable Greenhouse boards): Ocado case study, Roku non-Greenhouse careers,
 * generic Greenhouse marketing/careers pages without a board token.
 */

export interface JobBoardDirectoryEntry {
  /** Stable id; equals Greenhouse board token */
  id: string;
  displayName: string;
  category: string;
  /** Canonical board URL opened in headless browser for job discovery */
  boardUrl: string;
}

export const JOB_BOARD_DIRECTORY: JobBoardDirectoryEntry[] = [
  { id: 'anthropic', displayName: 'Anthropic', category: 'Artificial Intelligence', boardUrl: 'https://boards.greenhouse.io/anthropic' },
  { id: 'intercom', displayName: 'Intercom', category: 'Customer Communication', boardUrl: 'https://boards.greenhouse.io/intercom' },
  { id: 'twilio', displayName: 'Twilio', category: 'Cloud Communications', boardUrl: 'https://boards.greenhouse.io/twilio' },
  { id: 'gitlab', displayName: 'GitLab', category: 'DevOps / Version Control', boardUrl: 'https://boards.greenhouse.io/gitlab' },
  { id: 'newrelic', displayName: 'New Relic', category: 'Observability / Monitoring', boardUrl: 'https://boards.greenhouse.io/newrelic' },
  { id: 'squarespace', displayName: 'Squarespace', category: 'Website Builder', boardUrl: 'https://boards.greenhouse.io/squarespace' },
  { id: 'flexport', displayName: 'Flexport', category: 'Logistics / Supply Chain', boardUrl: 'https://boards.greenhouse.io/flexport' },
  { id: 'duolingo', displayName: 'Duolingo', category: 'EdTech', boardUrl: 'https://boards.greenhouse.io/duolingo' },
  { id: 'lyft', displayName: 'Lyft', category: 'Ridesharing / Transportation', boardUrl: 'https://boards.greenhouse.io/lyft' },
  { id: 'stripe', displayName: 'Stripe', category: 'FinTech / Payments', boardUrl: 'https://boards.greenhouse.io/stripe' },
  { id: 'airbnb', displayName: 'Airbnb', category: 'Travel / Homesharing', boardUrl: 'https://boards.greenhouse.io/airbnb' },
  { id: 'figma', displayName: 'Figma', category: 'Design / Collaboration', boardUrl: 'https://boards.greenhouse.io/figma' },
  { id: 'opendoor', displayName: 'Opendoor', category: 'Real Estate / PropTech', boardUrl: 'https://boards.greenhouse.io/opendoor' },
  { id: 'robinhood', displayName: 'Robinhood', category: 'FinTech / Investing', boardUrl: 'https://boards.greenhouse.io/robinhood' },
  { id: 'betterment', displayName: 'Betterment', category: 'FinTech / Wealth Management', boardUrl: 'https://boards.greenhouse.io/betterment' },
  { id: 'brex', displayName: 'Brex', category: 'FinTech / Corporate Cards', boardUrl: 'https://boards.greenhouse.io/brex' },
  { id: 'affirm', displayName: 'Affirm', category: 'FinTech / BNPL', boardUrl: 'https://boards.greenhouse.io/affirm' },
  { id: 'upstart', displayName: 'Upstart', category: 'FinTech / Lending', boardUrl: 'https://boards.greenhouse.io/upstart' },
  { id: 'creditkarma', displayName: 'Credit Karma', category: 'FinTech / Personal Finance', boardUrl: 'https://boards.greenhouse.io/creditkarma' },
  { id: 'fivetran', displayName: 'Fivetran', category: 'Data Integration', boardUrl: 'https://boards.greenhouse.io/fivetran' },
  { id: 'fastly', displayName: 'Fastly', category: 'CDN / Edge', boardUrl: 'https://boards.greenhouse.io/fastly' },
  { id: 'cloudflare', displayName: 'Cloudflare', category: 'CDN / Security', boardUrl: 'https://boards.greenhouse.io/cloudflare' },
  { id: 'datadog', displayName: 'Datadog', category: 'Observability / Monitoring', boardUrl: 'https://boards.greenhouse.io/datadog' },
  { id: 'okta', displayName: 'Okta', category: 'Identity / Security', boardUrl: 'https://boards.greenhouse.io/okta' },
  { id: 'elastic', displayName: 'Elastic', category: 'Search / Observability', boardUrl: 'https://boards.greenhouse.io/elastic' },
  { id: 'databricks', displayName: 'Databricks', category: 'Data / AI Platform', boardUrl: 'https://boards.greenhouse.io/databricks' },
  { id: 'applovin', displayName: 'AppLovin', category: 'Mobile Marketing', boardUrl: 'https://boards.greenhouse.io/applovin' },
  { id: 'opentable', displayName: 'OpenTable', category: 'Restaurant Tech', boardUrl: 'https://boards.greenhouse.io/opentable' },
  { id: 'coursera', displayName: 'Coursera', category: 'EdTech / MOOCs', boardUrl: 'https://boards.greenhouse.io/coursera' },
  { id: 'khanacademy', displayName: 'Khan Academy', category: 'EdTech / Nonprofit', boardUrl: 'https://boards.greenhouse.io/khanacademy' },
  { id: 'calendly', displayName: 'Calendly', category: 'Scheduling / Productivity', boardUrl: 'https://boards.greenhouse.io/calendly' },
  { id: 'melio', displayName: 'Melio', category: 'FinTech / B2B Payments', boardUrl: 'https://boards.greenhouse.io/melio' },
  { id: 'mercury', displayName: 'Mercury', category: 'FinTech / Banking', boardUrl: 'https://boards.greenhouse.io/mercury' },
  { id: 'papaya', displayName: 'Papaya', category: 'FinTech / Bill Pay', boardUrl: 'https://boards.greenhouse.io/papaya' },
  { id: 'workato', displayName: 'Workato', category: 'Automation / iPaaS', boardUrl: 'https://boards.greenhouse.io/workato' },
  { id: 'warp', displayName: 'Warp', category: 'Developer Tools', boardUrl: 'https://boards.greenhouse.io/warp' },
  { id: 'apex', displayName: 'Apex Eye', category: 'Healthcare / Ophthalmology', boardUrl: 'https://boards.greenhouse.io/apex' },
  { id: 'mixpanel', displayName: 'Mixpanel', category: 'Product Analytics', boardUrl: 'https://boards.greenhouse.io/mixpanel' },
  { id: 'amplitude', displayName: 'Amplitude', category: 'Product Analytics', boardUrl: 'https://boards.greenhouse.io/amplitude' },
  { id: 'postman', displayName: 'Postman', category: 'API Development', boardUrl: 'https://boards.greenhouse.io/postman' },
  { id: 'launchdarkly', displayName: 'LaunchDarkly', category: 'Feature Management', boardUrl: 'https://boards.greenhouse.io/launchdarkly' },
  { id: 'honeycomb', displayName: 'Honeycomb.io', category: 'Observability', boardUrl: 'https://boards.greenhouse.io/honeycomb' },
  { id: 'starburst', displayName: 'Starburst', category: 'Data / Analytics', boardUrl: 'https://boards.greenhouse.io/starburst' },
  { id: 'lastpass', displayName: 'LastPass', category: 'Password Management', boardUrl: 'https://boards.greenhouse.io/lastpass' },
  { id: 'dashlane', displayName: 'Dashlane', category: 'Password Management', boardUrl: 'https://boards.greenhouse.io/dashlane' },
  { id: 'cockroachlabs', displayName: 'Cockroach Labs', category: 'Database', boardUrl: 'https://boards.greenhouse.io/cockroachlabs' },
  { id: 'janestreet', displayName: 'Jane Street', category: 'Finance / Trading', boardUrl: 'https://boards.greenhouse.io/janestreet' },
  { id: 'optiver', displayName: 'Optiver', category: 'Finance / Trading', boardUrl: 'https://boards.greenhouse.io/optiver' },
  { id: 'ziprecruiter', displayName: 'ZipRecruiter', category: 'HR Tech', boardUrl: 'https://boards.greenhouse.io/ziprecruiter' },
  { id: 'indeed', displayName: 'Indeed', category: 'HR Tech', boardUrl: 'https://boards.greenhouse.io/indeed' },
  { id: 'glassdoor', displayName: 'Glassdoor', category: 'HR Tech', boardUrl: 'https://boards.greenhouse.io/glassdoor' },
  { id: 'roku', displayName: 'Roku', category: 'Streaming / Media', boardUrl: 'https://boards.greenhouse.io/roku' },
  { id: 'calm', displayName: 'Calm', category: 'Mental Health / Wellness', boardUrl: 'https://boards.greenhouse.io/calm' },
  { id: 'myfitnesspal', displayName: 'MyFitnessPal', category: 'Health / Fitness', boardUrl: 'https://boards.greenhouse.io/myfitnesspal' },
  { id: 'braze', displayName: 'Braze', category: 'Customer Engagement', boardUrl: 'https://boards.greenhouse.io/braze' },
];

export function getJobBoardById(id: string): JobBoardDirectoryEntry | undefined {
  return JOB_BOARD_DIRECTORY.find((b) => b.id === id);
}
