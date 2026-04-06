'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Send, Link as LinkIcon, Briefcase, Loader2, CheckCircle, XCircle, AlertCircle, FileText, Bot, User, Copy, Shield } from 'lucide-react';
import { PRESET_BOARDS } from '@/lib/preset-boards';
import { PresetBoardPicker } from '@/components/preset-board-picker';
import { runInFlight, useInFlight } from '@/lib/in-flight';

interface FilledField {
  field: string;
  value: string;
  source: 'template' | 'ai';
}

interface ApplicationResult {
  success: boolean;
  status: 'success' | 'failed' | 'requires_manual' | 'skipped';
  jobInfo: {
    jobTitle: string;
    companyName: string;
    location: string;
    department: string;
  };
  errorMessage?: string;
  filledFields?: FilledField[];
  securityCode?: string;
}

export default function ApplyPage() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [jobUrl, setJobUrl] = useState('');
  const [boardUrl, setBoardUrl] = useState('');
  const [selectedPresets, setSelectedPresets] = useState<Record<string, boolean>>(
    {}
  );
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const singleBusy = useInFlight('apply:single');
  const batchBusy = useInFlight('apply:batch');
  const loading = singleBusy || batchBusy;

  const handleSingleApply = async () => {
    if (!jobUrl.trim()) {
      setError('Please enter a job URL');
      return;
    }

    setError('');
    setResult(null);

    try {
      await runInFlight('apply:single', async () => {
        const response = await fetch('/api/apply/single', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobUrl }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit application');
        }

        setResult(data);
        setJobUrl('');
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    }
  };

  const togglePreset = (id: string) => {
    setSelectedPresets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleBatchApply = async () => {
    const presetIds = PRESET_BOARDS.filter((b) => selectedPresets[b.id]).map(
      (b) => b.id
    );
    const usePresets = presetIds.length > 0;
    if (!usePresets && !boardUrl.trim()) {
      setError('Select at least one preset company or enter a custom board URL');
      return;
    }

    setError('');
    setResult(null);

    const filters = {
      keywords: keywords || undefined,
      location: location || undefined,
      department: department || undefined,
    };

    try {
      await runInFlight('apply:batch', async () => {
        const response = await fetch(
          usePresets ? '/api/apply/preset-batch' : '/api/apply/batch',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              usePresets
                ? { boardIds: presetIds, filters }
                : { boardUrl, filters }
            ),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit applications');
        }

        setResult(data);
        if (!usePresets) setBoardUrl('');
        setKeywords('');
        setLocation('');
        setDepartment('');
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit applications');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'requires_manual':
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success':
        return 'Application Submitted';
      case 'failed':
        return 'Application Failed';
      case 'requires_manual':
        return 'Requires Manual Application';
      default:
        return 'Unknown Status';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center">
          <Send className="h-7 w-7 mr-2 text-brand-green" />
          Apply to Jobs
        </h1>
        <p className="text-muted-foreground mt-2">
          Submit applications automatically using your saved template
        </p>
      </div>

      {/* Mode Selection */}
      <div className="bg-card rounded-xl shadow-md p-6">
        <div className="flex space-x-4 mb-6">
          <button
            type="button"
            onClick={() => setMode('single')}
            disabled={loading}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              mode === 'single'
                ? 'bg-brand-orange text-white'
                : 'bg-muted text-foreground hover:bg-muted'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <LinkIcon className="h-5 w-5" />
            <span>Single Job</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('batch')}
            disabled={loading}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              mode === 'batch'
                ? 'bg-brand-orange text-white'
                : 'bg-muted text-foreground hover:bg-muted'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Briefcase className="h-5 w-5" />
            <span>Batch Application</span>
          </button>
        </div>

        {/* Single Job Mode */}
        {mode === 'single' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="jobUrl" className="block text-sm font-medium text-foreground mb-2">
                Job or careers page URL *
              </label>
              <input
                id="jobUrl"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://company.com/careers/job/… or boards.greenhouse.io/…/jobs/…"
                className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Use a direct Greenhouse link or your company&apos;s careers page if it embeds
                Greenhouse (we open the embedded board when needed).
              </p>
            </div>

            <button
              onClick={handleSingleApply}
              disabled={loading || !jobUrl.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Apply Now</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Batch Mode */}
        {mode === 'batch' && (
          <div className="space-y-4">
            <div>
              <p className="block text-sm font-medium text-foreground mb-2">
                Preset companies ({PRESET_BOARDS.length} boards)
              </p>
              <PresetBoardPicker
                selected={selectedPresets}
                onToggle={togglePreset}
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground mt-3">
                If you select any preset, only those boards are used for this run
                (custom URL is ignored). For hands-off auto-apply on a schedule and
                duplicate protection,{' '}
                <Link href="/dashboard/watch" className="text-brand-green font-medium hover:underline">
                  set up Auto pilot
                </Link>
                .
              </p>
            </div>

            <div>
              <label htmlFor="boardUrl" className="block text-sm font-medium text-foreground mb-2">
                Custom board or careers page URL (optional)
              </label>
              <input
                id="boardUrl"
                type="url"
                value={boardUrl}
                onChange={(e) => setBoardUrl(e.target.value)}
                placeholder="https://company.com/careers or job-boards.greenhouse.io/…"
                className="w-full px-4 py-3 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                disabled={loading}
              />
              <p className="text-sm text-muted-foreground mt-1">
                When no preset is selected: direct Greenhouse board URL, or a careers page
                that embeds Greenhouse (we resolve the board from the page).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="keywords" className="block text-sm font-medium text-foreground mb-2">
                  Keywords (optional)
                </label>
                <input
                  id="keywords"
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Software Engineer"
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-foreground mb-2">
                  Location (optional)
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-foreground mb-2">
                  Department (optional)
                </label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Each board run applies up to 50 jobs per request (skipping
                any job URL you already applied to successfully). Preset batch runs share that 50-job
                budget across selected boards. Auto pilot uses fewer per board per run so scheduled
                runs stay within hosting timeouts.
              </p>
            </div>

            <button
              onClick={handleBatchApply}
              disabled={
                loading ||
                (!Object.values(selectedPresets).some(Boolean) && !boardUrl.trim())
              }
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing Applications...</span>
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Apply to All Jobs</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-card rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">Application Results</h2>

          {mode === 'single' && result.result && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
                {getStatusIcon(result.result.status)}
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {result.result.jobInfo.jobTitle}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.result.jobInfo.companyName} - {result.result.jobInfo.location}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {getStatusText(result.result.status)}
                  </p>
                  {result.result.errorMessage && (
                    <p className="text-sm text-red-600 mt-1">
                      {result.result.errorMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Security Code Display */}
              {result.result.securityCode && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="h-5 w-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-800">Security Code Retrieved</h4>
                  </div>
                  <p className="text-sm text-amber-700 mb-3">
                    Greenhouse sent a security code to verify your application. Copy this code and enter it on the application page if needed:
                  </p>
                  <div className="flex items-center space-x-3">
                    <code className="flex-1 px-4 py-3 bg-card border-2 border-amber-400 rounded-lg text-2xl font-mono font-bold text-center tracking-widest text-foreground">
                      {result.result.securityCode}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(result.result.securityCode || '');
                      }}
                      className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center space-x-2"
                      title="Copy security code"
                    >
                      <Copy className="h-5 w-5" />
                      <span className="text-sm font-medium">Copy</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Filled Fields Details */}
              {result.result.filledFields && result.result.filledFields.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-brand-green" />
                      Fields Filled ({result.result.filledFields.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {result.result.filledFields.map((ff: FilledField, idx: number) => (
                      <div key={idx} className="flex items-center px-4 py-2.5 hover:bg-muted/50">
                        <div className="flex-shrink-0 mr-3">
                          {ff.source === 'template' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              <User className="h-3 w-3 mr-1" />
                              Template
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              <Bot className="h-3 w-3 mr-1" />
                              AI
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">{ff.field}</span>
                        </div>
                        <div className="flex-shrink-0 ml-4 max-w-[50%]">
                          <span className="text-sm text-muted-foreground truncate block" title={ff.value}>
                            {ff.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-muted/50 px-4 py-2 border-t border-border">
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 mr-1.5"></span>
                        Template: {result.result.filledFields.filter((f: FilledField) => f.source === 'template').length} fields
                      </span>
                      <span className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-purple-400 mr-1.5"></span>
                        AI: {result.result.filledFields.filter((f: FilledField) => f.source === 'ai').length} fields
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'batch' && result.results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">Successful</p>
                  <p className="text-2xl font-bold text-green-900">{result.successCount || 0}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700">Failed</p>
                  <p className="text-2xl font-bold text-red-900">{result.failedCount || 0}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-700">Requires Manual</p>
                  <p className="text-2xl font-bold text-amber-900">{result.manualCount || 0}</p>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.results.map((item: ApplicationResult, index: number) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{item.jobInfo.jobTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.jobInfo.companyName} - {item.jobInfo.location}
                      </p>
                      {item.errorMessage && (
                        <p className="text-sm text-red-600 mt-1">{item.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
