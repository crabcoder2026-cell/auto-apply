/**
 * Greenhouse boards scraped for Auto Search (job discovery).
 * Currently only Figma; add entries to include more boards.
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
    id: 'figma',
    displayName: 'Figma',
    category: 'Design / Collaboration',
    boardUrl: 'https://boards.greenhouse.io/figma',
  },
];

export function getJobBoardById(id: string): JobBoardDirectoryEntry | undefined {
  return JOB_BOARD_DIRECTORY.find((b) => b.id === id);
}
