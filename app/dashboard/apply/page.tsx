'use client';

import { useState } from 'react';
import { Send, Link as LinkIcon, Briefcase, Loader2, CheckCircle, XCircle, AlertCircle, FileText, Bot, User, Copy, Shield } from 'lucide-react';

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
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSingleApply = async () => {
    if (!jobUrl.trim()) {
      setError('Please enter a job URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
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
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const handleBatchApply = async () => {
    if (!boardUrl.trim()) {
      setError('Please enter a board URL');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/apply/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardUrl,
          filters: {
            keywords: keywords || undefined,
            location: location || undefined,
            department: department || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit applications');
      }

      setResult(data);
      setBoardUrl('');
      setKeywords('');
      setLocation('');
      setDepartment('');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit applications');
    } finally {
      setLoading(false);
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
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
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
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Send className="h-7 w-7 mr-2 text-indigo-600" />
          Apply to Jobs
        </h1>
        <p className="text-gray-600 mt-2">
          Submit applications automatically using your saved template
        </p>
      </div>

      {/* Mode Selection */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setMode('single')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              mode === 'single'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <LinkIcon className="h-5 w-5" />
            <span>Single Job</span>
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
              mode === 'batch'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Briefcase className="h-5 w-5" />
            <span>Batch Application</span>
          </button>
        </div>

        {/* Single Job Mode */}
        {mode === 'single' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="jobUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Greenhouse Job URL *
              </label>
              <input
                id="jobUrl"
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/company/jobs/123456"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the direct link to a Greenhouse job posting
              </p>
            </div>

            <button
              onClick={handleSingleApply}
              disabled={loading || !jobUrl.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
              <label htmlFor="boardUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Greenhouse Job Board URL *
              </label>
              <input
                id="boardUrl"
                type="url"
                value={boardUrl}
                onChange={(e) => setBoardUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/company"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-1">
                Enter the company's Greenhouse job board URL
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 mb-2">
                  Keywords (optional)
                </label>
                <input
                  id="keywords"
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Software Engineer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location (optional)
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  Department (optional)
                </label>
                <input
                  id="department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Engineering"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Batch applications are limited to 10 jobs per request to ensure quality submissions.
              </p>
            </div>

            <button
              onClick={handleBatchApply}
              disabled={loading || !boardUrl.trim()}
              className="w-full flex items-center justify-center space-x-2 py-3 px-6 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Application Results</h2>

          {mode === 'single' && result.result && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                {getStatusIcon(result.result.status)}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {result.result.jobInfo.jobTitle}
                  </p>
                  <p className="text-sm text-gray-600">
                    {result.result.jobInfo.companyName} - {result.result.jobInfo.location}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mt-1">
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
                    <code className="flex-1 px-4 py-3 bg-white border-2 border-amber-400 rounded-lg text-2xl font-mono font-bold text-center tracking-widest text-gray-900">
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
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-indigo-600" />
                      Fields Filled ({result.result.filledFields.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {result.result.filledFields.map((ff: FilledField, idx: number) => (
                      <div key={idx} className="flex items-center px-4 py-2.5 hover:bg-gray-50">
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
                          <span className="text-sm font-medium text-gray-700">{ff.field}</span>
                        </div>
                        <div className="flex-shrink-0 ml-4 max-w-[50%]">
                          <span className="text-sm text-gray-600 truncate block" title={ff.value}>
                            {ff.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
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
                  <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                    {getStatusIcon(item.status)}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.jobInfo.jobTitle}</p>
                      <p className="text-sm text-gray-600">
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
