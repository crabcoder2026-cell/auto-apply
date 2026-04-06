'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import {
  PRESET_BOARDS,
  getPresetBoardsGrouped,
  type PresetBoard,
} from '@/lib/preset-boards';

type Props = {
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  disabled?: boolean;
};

export function PresetBoardPicker({ selected, onToggle, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => getPresetBoardsGrouped(), []);

  const q = query.trim().toLowerCase();
  const filteredGrouped = useMemo(() => {
    if (!q) return grouped;
    const next = new Map<string, PresetBoard[]>();
    for (const [category, boards] of grouped) {
      const rows = boards.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );
      if (rows.length) next.set(category, rows);
    }
    return next;
  }, [grouped, q]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const visibleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const boards of filteredGrouped.values()) {
      for (const b of boards) ids.add(b.id);
    }
    return ids;
  }, [filteredGrouped]);

  const selectFiltered = () => {
    for (const id of visibleIds) {
      if (!selected[id]) onToggle(id);
    }
  };

  const clearFiltered = () => {
    for (const id of visibleIds) {
      if (selected[id]) onToggle(id);
    }
  };

  const toggleCategory = (category: string) => {
    setCollapsed((c) => ({ ...c, [category]: !c[category] }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search companies, category, or board id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            aria-label="Filter preset companies"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            disabled={disabled || visibleIds.size === 0}
            onClick={selectFiltered}
            className="px-3 py-1.5 rounded-lg border border-brand-green text-brand-green hover:bg-brand-green-muted disabled:opacity-50"
          >
            Select all matching
          </button>
          <button
            type="button"
            disabled={disabled || visibleIds.size === 0}
            onClick={clearFiltered}
            className="rounded-lg border border-input px-3 py-1.5 text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Clear matching
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedCount} selected · {PRESET_BOARDS.length} boards ·{' '}
        <span className="text-foreground/80">
          Badge shows Greenhouse URL style (both work for apply).
        </span>
      </p>

      <div className="max-h-[min(28rem,55vh)] divide-y divide-border overflow-y-auto rounded-xl border-2 border-border bg-card">
        {filteredGrouped.size === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No companies match.</p>
        ) : (
          [...filteredGrouped.entries()].map(([category, boards]) => {
            const isCollapsed = collapsed[category];
            return (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1">{category}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {boards.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul className="p-2 space-y-1">
                    {boards.map((b) => (
                      <li key={b.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/40">
                          <input
                            type="checkbox"
                            checked={!!selected[b.id]}
                            onChange={() => onToggle(b.id)}
                            disabled={disabled}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 gap-y-1">
                              <span className="text-sm font-medium text-foreground">
                                {b.name}
                              </span>
                              <span
                                className={
                                  b.urlHost === 'job-boards'
                                    ? 'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200'
                                }
                                title={
                                  b.urlHost === 'job-boards'
                                    ? 'job-boards.greenhouse.io'
                                    : 'boards.greenhouse.io'
                                }
                              >
                                {b.urlHost === 'job-boards'
                                  ? 'job-boards'
                                  : 'boards'}
                              </span>
                            </div>
                            <p
                              className="mt-0.5 truncate text-xs text-muted-foreground"
                              title={b.url}
                            >
                              {b.url}
                            </p>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
