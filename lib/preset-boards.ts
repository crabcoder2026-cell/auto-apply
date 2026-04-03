/** Preset Greenhouse job boards selectable in the UI */
export const PRESET_BOARDS = [
  {
    id: 'wppmedia',
    name: 'WPP Media',
    url: 'https://job-boards.greenhouse.io/wppmedia',
  },
  {
    id: 'capco',
    name: 'Capco',
    url: 'https://job-boards.greenhouse.io/capco',
  },
] as const;

export type PresetBoardId = (typeof PRESET_BOARDS)[number]['id'];

export function getPresetBoardById(id: string) {
  return PRESET_BOARDS.find((b) => b.id === id);
}
