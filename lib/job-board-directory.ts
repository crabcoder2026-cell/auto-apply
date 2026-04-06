/**
 * Greenhouse boards scraped for Auto Search (job discovery).
 * Currently only Anthropic; add entries to include more boards.
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
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    category: 'Artificial Intelligence',
    boardUrl: 'https://job-boards.greenhouse.io/anthropic',
  },
];

export function getJobBoardById(id: string): JobBoardDirectoryEntry | undefined {
  return JOB_BOARD_DIRECTORY.find((b) => b.id === id);
}
