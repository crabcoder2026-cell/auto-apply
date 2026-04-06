'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, ExternalLink, Search, Filter, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Application {
  id: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string;
  location: string | null;
  department: string | null;
  status: string;
  errorMessage: string | null;
  appliedAt: string;
  applicationData?: unknown | null;
}

type HistorySourceKey = 'watch' | 'single' | 'batch' | 'preset_batch' | 'unknown';

function getApplicationSource(app: Application): HistorySourceKey {
  const d = app.applicationData as { source?: string } | null | undefined;
  const s = d?.source;
  if (s === 'watch' || s === 'single' || s === 'batch' || s === 'preset_batch')
    return s;
  return 'unknown';
}

function applicationSourceLabel(source: HistorySourceKey): string {
  switch (source) {
    case 'watch':
      return 'Auto pilot';
    case 'single':
      return 'Single job';
    case 'batch':
      return 'Batch · custom board';
    case 'preset_batch':
      return 'Batch · presets';
    default:
      return 'Apply';
  }
}

export default function HistoryPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/history', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setApplications(data?.applications || []);
      }
    } catch (error: unknown) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const onFocus = () => fetchHistory();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchHistory]);

  useEffect(() => {
    let filtered = applications;
    if (searchTerm) {
      filtered = filtered.filter(
        (app) =>
          app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          app.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((app) => app.status === statusFilter);
    }
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((app) => {
        const s = getApplicationSource(app);
        if (sourceFilter === 'auto_pilot') return s === 'watch';
        if (sourceFilter === 'regular')
          return s === 'single' || s === 'batch' || s === 'preset_batch' || s === 'unknown';
        return true;
      });
    }
    setFilteredApplications(filtered);
  }, [searchTerm, statusFilter, sourceFilter, applications]);

  const getStatusBadge = (status: string) => {
    const badges = {
      success: (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          <span>Success</span>
        </span>
      ),
      failed: (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-3 w-3" />
          <span>Failed</span>
        </span>
      ),
      requires_manual: (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <AlertCircle className="h-3 w-3" />
          <span>Requires Manual</span>
        </span>
      ),
      skipped: (
        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="h-3 w-3" />
          <span>Skipped</span>
        </span>
      ),
    };

    return badges[status as keyof typeof badges] || badges.skipped;
  };

  const sourceBadge = (app: Application) => {
    const src = getApplicationSource(app);
    const isPilot = src === 'watch';
    return (
      <span
        className={
          isPilot
            ? 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-900 border border-violet-200'
            : 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200'
        }
      >
        {applicationSourceLabel(src)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <History className="h-7 w-7 mr-2 text-brand-green" />
          Application History
        </h1>
        <p className="text-gray-600 mt-2">
          Track and review all your job applications
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job title or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="requires_manual">Requires Manual</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent appearance-none"
              aria-label="Filter by how you applied"
            >
              <option value="all">All sources</option>
              <option value="auto_pilot">Auto pilot only</option>
              <option value="regular">Apply page only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {filteredApplications.length === 0 ? (
          <div className="p-12 text-center">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">
              {applications.length === 0
                ? 'No applications yet'
                : 'No applications match your filters'}
            </p>
            {applications.length === 0 && (
              <Link
                href="/dashboard/apply"
                className="inline-block mt-4 px-6 py-2 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-hover transition-colors"
              >
                Apply to Your First Job
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{app.jobTitle}</p>
                        {app.location && (
                          <p className="text-sm text-gray-500">{app.location}</p>
                        )}
                        {app.department && (
                          <p className="text-xs text-gray-400 mt-1">{app.department}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{app.companyName}</p>
                    </td>
                    <td className="px-6 py-4">{sourceBadge(app)}</td>
                    <td className="px-6 py-4">
                      <div>
                        {getStatusBadge(app.status)}
                        {app.errorMessage && (
                          <p className="text-xs text-red-600 mt-1 max-w-xs">
                            {app.errorMessage}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{formatDate(app.appliedAt)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-sm text-brand-green hover:text-brand-green-hover"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>View Job</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {applications.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
          Showing {filteredApplications.length} of {applications.length} applications
        </div>
      )}
    </div>
  );
}
