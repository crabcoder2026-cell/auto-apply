'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Gauge,
  Loader2,
  Save,
  Play,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { PRESET_BOARDS } from '@/lib/preset-boards';
import { PresetBoardPicker } from '@/components/preset-board-picker';
import { runInFlight, useInFlight } from '@/lib/in-flight';

interface WatchState {
  enabled: boolean;
  selectedBoardIds: string[];
  keywords: string;
  location: string;
  department: string;
  appliedJobKeysCount: number;
  lastRunAt: string | null;
  lastRunSummary: string | null;
  updatedAt: string;
}

export default function WatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const saving = useInFlight('watch:save');
  const running = useInFlight('watch:run');
  const [runMessage, setRunMessage] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [meta, setMeta] = useState({
    appliedJobKeysCount: 0,
    lastRunAt: null as string | null,
    lastRunSummary: null as string | null,
    updatedAt: '',
  });

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/watch', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const w = data as WatchState;
      setEnabled(w.enabled);
      const sel: Record<string, boolean> = {};
      for (const id of w.selectedBoardIds || []) sel[id] = true;
      setSelected(sel);
      setKeywords(w.keywords || '');
      setLocation(w.location || '');
      setDepartment(w.department || '');
      setMeta({
        appliedJobKeysCount: w.appliedJobKeysCount ?? 0,
        lastRunAt: w.lastRunAt,
        lastRunSummary: w.lastRunSummary,
        updatedAt: w.updatedAt,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Cron updates last run on the server; refresh status while this tab is open */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      load();
    };
    const id = window.setInterval(tick, 90_000);
    const onVis = () => tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const toggleBoard = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const save = async () => {
    setError('');
    try {
      await runInFlight('watch:save', async () => {
        const selectedBoardIds = PRESET_BOARDS.filter((b) => selected[b.id]).map(
          (b) => b.id
        );
        const res = await fetch('/api/watch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled,
            selectedBoardIds,
            keywords,
            location,
            department,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        setMeta((m) => ({
          ...m,
          appliedJobKeysCount: data.appliedJobKeysCount ?? m.appliedJobKeysCount,
          updatedAt: data.updatedAt,
        }));
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const runNow = async () => {
    setError('');
    setRunMessage('');
    try {
      await runInFlight('watch:run', async () => {
        const res = await fetch('/api/watch/run', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.details || 'Run failed');
        setRunMessage(data.summary || 'Done');
        await load();
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Run failed');
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-card rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Gauge className="h-7 w-7 text-brand-green" />
          Auto pilot
        </h1>
        <p className="text-muted-foreground mt-2">
          Auto pilot runs in the background on a schedule and sends applications for you
          when new listings appear on your selected boards that match your keywords and
          filters. It uses your saved profile template. Roles you have already applied to
          are skipped so you do not duplicate.
        </p>
        <p className="text-sm text-muted-foreground mt-3">
          For one-off applies without the schedule, use{' '}
          <Link href="/dashboard/apply" className="text-brand-green font-medium hover:underline">
            Apply to Jobs
          </Link>
          .
        </p>
      </div>

      <div className="bg-card rounded-xl shadow-md p-6 space-y-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={saving || running}
            className="h-4 w-4 rounded border-input text-brand-orange focus:ring-brand-green disabled:opacity-50"
          />
          <span className="font-medium text-foreground">
            Enable Auto pilot (scheduled auto-apply — requires cron setup below)
          </span>
        </label>

        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Companies ({PRESET_BOARDS.length} Greenhouse boards)
          </p>
          <PresetBoardPicker
            selected={selected}
            onToggle={toggleBoard}
            disabled={saving || running}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Keywords
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. engineer, data"
              disabled={saving || running}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional"
              disabled={saving || running}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Optional"
              disabled={saving || running}
              className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || running}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-orange text-white rounded-lg font-medium hover:bg-brand-orange-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Auto pilot settings
          </button>
          <button
            type="button"
            onClick={runNow}
            disabled={running || saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-brand-green text-brand-green rounded-lg font-medium hover:bg-brand-green-muted disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Auto pilot now
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {runMessage && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {runMessage}
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl shadow-md p-6 space-y-3">
        <h2 className="font-semibold text-foreground">Auto pilot status</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Jobs already applied (skipped next time)</dt>
            <dd className="font-medium text-foreground">{meta.appliedJobKeysCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last run</dt>
            <dd className="font-medium text-foreground">
              {meta.lastRunAt
                ? new Date(meta.lastRunAt).toLocaleString()
                : '—'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Last summary</dt>
            <dd className="font-medium text-foreground">
              {meta.lastRunSummary || '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
        <p className="font-semibold">Scheduling Auto pilot (about every 10 minutes)</p>
        <p>
          The server does not wake itself up. Set{' '}
          <code className="bg-amber-100 px-1 rounded">CRON_SECRET</code> in your
          environment, then call the endpoint below on a timer so Auto pilot can
          auto-apply for you:
        </p>
        <pre className="bg-card/80 border border-amber-200 rounded-lg p-3 overflow-x-auto text-xs">
          {`curl -sS -H "Authorization: Bearer $CRON_SECRET" \\
  "$NEXTAUTH_URL/api/cron/watch"`}
        </pre>
        <p className="text-amber-900/90">
          Use systemd timer, GitHub Actions, cron on a VPS, or your host&apos;s
          scheduled jobs. On Vercel you can add{' '}
          <code className="bg-amber-100 px-1 rounded">vercel.json</code> with a
          cron entry (check plan limits for minimum interval).
        </p>
      </div>
    </div>
  );
}
