'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Template {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  resumeFileName: string | null;
  coverLetter: string | null;
  workAuthStatus: string | null;
  yearsExperience: number | null;
  updatedAt: string;
}

export default function DashboardPage() {
  const { data: session } = useSession() || {};
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    manual: 0,
  });

  useEffect(() => {
    fetchTemplate();
    fetchStats();
  }, []);

  const fetchTemplate = async () => {
    try {
      const response = await fetch('/api/template');
      const data = await response.json();
      setTemplate(data?.template || null);
    } catch (error: any) {
      console.error('Error fetching template:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/history/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data?.stats || stats);
      }
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-brand-green to-brand-green-hover rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {session?.user?.name || 'there'}!
        </h1>
        <p className="text-white/90">
          Automate your job applications on Greenhouse.io with your saved template
        </p>
      </div>

      {/* Template Status */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-brand-green" />
            Application Template
          </h2>
          <Link
            href="/dashboard/template"
            className="text-sm font-medium text-brand-green hover:text-brand-green-hover"
          >
            {template ? 'Edit Template' : 'Create Template'}
          </Link>
        </div>

        {template ? (
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900">
                  Template is ready!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  Your application template is saved and ready to use for job applications.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-medium text-gray-900">{template.fullName}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium text-gray-900">{template.email}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Resume</p>
                <p className="font-medium text-gray-900">
                  {template.resumeFileName || 'Not uploaded'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Years of Experience</p>
                <p className="font-medium text-gray-900">
                  {template.yearsExperience || 'Not specified'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">
                No template found
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Create your application template to start applying to jobs automatically.
              </p>
              <Link
                href="/dashboard/template"
                className="inline-block mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                Create Template Now
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Applications</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="h-12 w-12 bg-brand-green-muted rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-brand-green" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Successful</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.success}</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-1">{stats.failed}</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Requires Manual</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.manual}</p>
            </div>
            <div className="h-12 w-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/dashboard/apply"
          className="group bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-brand-orange/40"
        >
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-brand-green-muted rounded-lg flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
              <Upload className="h-6 w-6 text-brand-green" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Apply to Jobs</h3>
              <p className="text-sm text-gray-600">Submit applications automatically</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/history"
          className="group bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-brand-orange/40"
        >
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-brand-green-muted rounded-lg flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
              <FileText className="h-6 w-6 text-brand-green" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">View History</h3>
              <p className="text-sm text-gray-600">Track your applications</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
