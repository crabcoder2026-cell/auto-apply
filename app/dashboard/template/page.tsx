'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Upload, Loader2, CheckCircle, FileText, Mail, ShieldCheck } from 'lucide-react';

interface Template {
  id: string;
  resumePath: string | null;
  resumeFileName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  coverLetter: string | null;
  workAuthStatus: string | null;
  yearsExperience: number | null;
  currentLocation: string | null;
}

export default function TemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    resumePath: '',
    resumeFileName: '',
    fullName: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    portfolioUrl: '',
    coverLetter: '',
    workAuthStatus: '',
    yearsExperience: '',
    currentLocation: '',
    country: '',
    imapProvider: '',
    imapHost: '',
    imapPort: '993',
    imapPassword: '',
  });
  const [testingImap, setTestingImap] = useState(false);
  const [imapTestResult, setImapTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [storageDriver, setStorageDriver] = useState<'local' | 's3' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchTemplate(), fetchUploadSettings()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchUploadSettings = async () => {
    try {
      const res = await fetch('/api/upload/settings');
      const data = res.ok ? await res.json() : null;
      if (data?.driver === 'local' || data?.driver === 's3') {
        setStorageDriver(data.driver);
      } else {
        setStorageDriver('local');
      }
    } catch (e) {
      console.error('Error fetching upload settings:', e);
      setStorageDriver('local');
    }
  };

  const fetchTemplate = async () => {
    try {
      const response = await fetch('/api/template');
      const data = await response.json();

      if (data?.template) {
        const template = data.template;
        const additionalFields = template.additionalFields || {};
        setFormData({
          resumePath: template.resumePath || '',
          resumeFileName: template.resumeFileName || '',
          fullName: template.fullName || '',
          email: template.email || '',
          phone: template.phone || '',
          linkedinUrl: template.linkedinUrl || '',
          portfolioUrl: template.portfolioUrl || '',
          coverLetter: template.coverLetter || '',
          workAuthStatus: template.workAuthStatus || '',
          yearsExperience: template.yearsExperience?.toString() || '',
          currentLocation: template.currentLocation || '',
          country: additionalFields.country || '',
          imapProvider: additionalFields.imapProvider || '',
          imapHost: additionalFields.imapHost || '',
          imapPort: additionalFields.imapPort || '993',
          imapPassword: additionalFields.imapPassword || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching template:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or DOCX file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      if (storageDriver === 'local') {
        const formData = new FormData();
        formData.append('file', file);
        const uploadResponse = await fetch('/api/upload/local', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          const err = await uploadResponse.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to upload file');
        }
        const { cloud_storage_path, resumeFileName } = await uploadResponse.json();
        setFormData((prev) => ({
          ...prev,
          resumePath: cloud_storage_path,
          resumeFileName: resumeFileName || file.name,
        }));
      } else {
        const presignedResponse = await fetch('/api/upload/presigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            isPublic: false,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error('Failed to get upload URL');
        }

        const { uploadUrl, cloud_storage_path } = await presignedResponse.json();

        const url = new URL(uploadUrl);
        const signedHeaders = url.searchParams.get('X-Amz-SignedHeaders');
        const needsContentDisposition = signedHeaders?.includes('content-disposition');

        const uploadHeaders: HeadersInit = {
          'Content-Type': file.type,
        };

        if (needsContentDisposition) {
          uploadHeaders['Content-Disposition'] = 'attachment';
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        setFormData((prev) => ({
          ...prev,
          resumePath: cloud_storage_path,
          resumeFileName: file.name,
        }));
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Failed to upload resume. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSuccess(false);

    try {
      const response = await fetch('/api/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-card rounded-xl shadow-md p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            <FileText className="h-7 w-7 mr-2 text-brand-green" />
            Application Template
          </h1>
          <p className="text-muted-foreground mt-2">
            Save your application details once and use them for all job applications
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-green-700 font-medium">Template saved successfully!</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Resume Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Resume (PDF or DOCX) *
            </label>
            <div className="flex items-center space-x-4">
              <label className="flex-1 cursor-pointer">
                <div className="border-2 border-dashed border-input rounded-lg p-6 hover:border-brand-orange/50 transition-colors">
                  <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                    {uploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : formData.resumeFileName ? (
                      <>
                        <FileText className="h-5 w-5 text-green-600" />
                        <span className="text-green-600 font-medium">
                          {formData.resumeFileName}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        <span>Click to upload resume</span>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email Address *
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label htmlFor="currentLocation" className="block text-sm font-medium text-foreground mb-2">
                Location (City) *
              </label>
              <input
                id="currentLocation"
                type="text"
                required
                value={formData.currentLocation}
                onChange={(e) => setFormData({ ...formData, currentLocation: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="San Francisco, CA"
              />
              <p className="text-xs text-muted-foreground mt-1">Used for &quot;Location (City)&quot; fields on Greenhouse forms</p>
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-foreground mb-2">
                Country of Residence *
              </label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent bg-card"
              >
                <option value="">Select country</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="India">India</option>
                <option value="China">China</option>
                <option value="Japan">Japan</option>
                <option value="South Korea">South Korea</option>
                <option value="Brazil">Brazil</option>
                <option value="Mexico">Mexico</option>
                <option value="Netherlands">Netherlands</option>
                <option value="Sweden">Sweden</option>
                <option value="Switzerland">Switzerland</option>
                <option value="Singapore">Singapore</option>
                <option value="Ireland">Ireland</option>
                <option value="Israel">Israel</option>
                <option value="Spain">Spain</option>
                <option value="Italy">Italy</option>
                <option value="Poland">Poland</option>
                <option value="Argentina">Argentina</option>
                <option value="Colombia">Colombia</option>
                <option value="Chile">Chile</option>
                <option value="New Zealand">New Zealand</option>
                <option value="Philippines">Philippines</option>
                <option value="Vietnam">Vietnam</option>
                <option value="Thailand">Thailand</option>
                <option value="Indonesia">Indonesia</option>
                <option value="Malaysia">Malaysia</option>
                <option value="Nigeria">Nigeria</option>
                <option value="South Africa">South Africa</option>
                <option value="Kenya">Kenya</option>
                <option value="Egypt">Egypt</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
                <option value="Turkey">Turkey</option>
                <option value="Russia">Russia</option>
                <option value="Ukraine">Ukraine</option>
                <option value="Pakistan">Pakistan</option>
                <option value="Bangladesh">Bangladesh</option>
                <option value="Portugal">Portugal</option>
                <option value="Denmark">Denmark</option>
                <option value="Norway">Norway</option>
                <option value="Finland">Finland</option>
                <option value="Austria">Austria</option>
                <option value="Belgium">Belgium</option>
                <option value="Czech Republic">Czech Republic</option>
                <option value="Romania">Romania</option>
                <option value="Hungary">Hungary</option>
              </select>
            </div>

            <div>
              <label htmlFor="linkedinUrl" className="block text-sm font-medium text-foreground mb-2">
                LinkedIn Profile URL *
              </label>
              <input
                id="linkedinUrl"
                type="url"
                required
                value={formData.linkedinUrl}
                onChange={(e) => setFormData({ ...formData, linkedinUrl: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="https://linkedin.com/in/johndoe"
              />
              <p className="text-xs text-muted-foreground mt-1">Required by most Greenhouse job applications</p>
            </div>

            <div>
              <label htmlFor="portfolioUrl" className="block text-sm font-medium text-foreground mb-2">
                Portfolio/Website URL
              </label>
              <input
                id="portfolioUrl"
                type="url"
                value={formData.portfolioUrl}
                onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="https://johndoe.com"
              />
            </div>

            <div>
              <label htmlFor="workAuthStatus" className="block text-sm font-medium text-foreground mb-2">
                Work Authorization Status
              </label>
              <select
                id="workAuthStatus"
                value={formData.workAuthStatus}
                onChange={(e) => setFormData({ ...formData, workAuthStatus: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
              >
                <option value="">Select status</option>
                <option value="US Citizen">US Citizen</option>
                <option value="Green Card">Green Card</option>
                <option value="Work Visa">Work Visa (H1B, etc.)</option>
                <option value="Requires Sponsorship">Requires Sponsorship</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="yearsExperience" className="block text-sm font-medium text-foreground mb-2">
                Years of Experience
              </label>
              <input
                id="yearsExperience"
                type="number"
                min="0"
                max="50"
                value={formData.yearsExperience}
                onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })}
                className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                placeholder="5"
              />
            </div>
          </div>

          {/* Cover Letter */}
          <div>
            <label htmlFor="coverLetter" className="block text-sm font-medium text-foreground mb-2">
              Cover Letter Template
            </label>
            <textarea
              id="coverLetter"
              rows={8}
              value={formData.coverLetter}
              onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
              className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
              placeholder="Write a general cover letter that can be used across applications..."
            />
          </div>

          {/* Email IMAP Settings for Security Code Verification */}
          <div className="border-t border-border pt-6 mt-6">
            <div className="flex items-center mb-4">
              <ShieldCheck className="h-5 w-5 text-brand-green mr-2" />
              <h2 className="text-lg font-semibold text-foreground">Email Verification Settings</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Greenhouse may send a security code to your email during application. Configure your email IMAP
              settings below so the app can automatically retrieve and enter the code.
              For Gmail, you need an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-brand-green underline">App Password</a> (requires 2FA enabled).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="imapProvider" className="block text-sm font-medium text-foreground mb-2">
                  Email Provider
                </label>
                <select
                  id="imapProvider"
                  value={formData.imapProvider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    const presets: Record<string, { host: string; port: string }> = {
                      gmail: { host: 'imap.gmail.com', port: '993' },
                      outlook: { host: 'outlook.office365.com', port: '993' },
                      yahoo: { host: 'imap.mail.yahoo.com', port: '993' },
                      icloud: { host: 'imap.mail.me.com', port: '993' },
                      custom: { host: '', port: '993' },
                    };
                    const preset = presets[provider] || { host: '', port: '993' };
                    setFormData({
                      ...formData,
                      imapProvider: provider,
                      imapHost: preset.host,
                      imapPort: preset.port,
                    });
                    setImapTestResult(null);
                  }}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                >
                  <option value="">Select provider...</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook / Microsoft 365</option>
                  <option value="yahoo">Yahoo Mail</option>
                  <option value="icloud">iCloud Mail</option>
                  <option value="custom">Custom IMAP Server</option>
                </select>
              </div>

              <div>
                <label htmlFor="imapHost" className="block text-sm font-medium text-foreground mb-2">
                  IMAP Server Host
                </label>
                <input
                  id="imapHost"
                  type="text"
                  value={formData.imapHost}
                  onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  placeholder="imap.gmail.com"
                  readOnly={formData.imapProvider !== 'custom' && formData.imapProvider !== ''}
                />
              </div>

              <div>
                <label htmlFor="imapPort" className="block text-sm font-medium text-foreground mb-2">
                  IMAP Port
                </label>
                <input
                  id="imapPort"
                  type="number"
                  value={formData.imapPort}
                  onChange={(e) => setFormData({ ...formData, imapPort: e.target.value })}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  placeholder="993"
                  readOnly={formData.imapProvider !== 'custom' && formData.imapProvider !== ''}
                />
              </div>

              <div>
                <label htmlFor="imapPassword" className="block text-sm font-medium text-foreground mb-2">
                  Email Password / App Password
                </label>
                <input
                  id="imapPassword"
                  type="password"
                  value={formData.imapPassword}
                  onChange={(e) => {
                    setFormData({ ...formData, imapPassword: e.target.value });
                    setImapTestResult(null);
                  }}
                  className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
                  placeholder={formData.imapProvider === 'gmail' ? 'Gmail App Password (16 chars)' : 'Your email password'}
                />
                {formData.imapProvider === 'gmail' && (
                  <p className="mt-1 text-xs text-amber-600">
                    Gmail requires an App Password. Go to Google Account → Security → 2-Step Verification → App passwords.
                  </p>
                )}
              </div>
            </div>

            {/* Test Connection Button */}
            {formData.imapHost && formData.imapPassword && formData.email && (
              <div className="mt-4 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={async () => {
                    setTestingImap(true);
                    setImapTestResult(null);
                    try {
                      const res = await fetch('/api/test-imap', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          imapHost: formData.imapHost,
                          imapPort: formData.imapPort,
                          email: formData.email,
                          imapPassword: formData.imapPassword,
                        }),
                      });
                      const result = await res.json();
                      setImapTestResult(result);
                    } catch {
                      setImapTestResult({ success: false, error: 'Failed to test connection' });
                    } finally {
                      setTestingImap(false);
                    }
                  }}
                  disabled={testingImap}
                  className="flex items-center space-x-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {testingImap ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      <span>Test Email Connection</span>
                    </>
                  )}
                </button>
                {imapTestResult && (
                  <span className={`text-sm font-medium ${imapTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {imapTestResult.success
                      ? '✓ Connection successful!'
                      : `✗ ${imapTestResult.error || 'Connection failed'}`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center space-x-4">
            <button
              type="submit"
              disabled={saving || !formData.fullName || !formData.email || !formData.linkedinUrl || !formData.currentLocation || !formData.country}
              className="flex items-center space-x-2 px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-brand-orange-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  <span>Save Template</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-6 py-3 border border-input text-foreground rounded-lg hover:bg-muted/50 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
