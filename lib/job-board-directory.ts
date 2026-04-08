/**
 * Greenhouse boards scraped for Auto Search (job discovery).
 * Kept in sync with {@link PRESET_BOARDS} so Auto Pilot and Auto Search use the same deduped directory.
 */

import { PRESET_BOARDS } from '@/lib/preset-boards';

export interface JobBoardDirectoryEntry {
  /** Stable id; equals Greenhouse board token */
  id: string;
  displayName: string;
  category: string;
  /** Canonical board URL opened in headless browser for job discovery */
  boardUrl: string;
}

export const JOB_BOARD_DIRECTORY: JobBoardDirectoryEntry[] = PRESET_BOARDS.map(
  (b) => ({
    id: b.id,
    displayName: b.name,
    category: b.category,
    boardUrl: b.url,
  })
);

export function getJobBoardById(id: string): JobBoardDirectoryEntry | undefined {
  return JOB_BOARD_DIRECTORY.find((board) => board.id === id);
}
