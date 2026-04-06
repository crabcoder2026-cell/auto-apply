'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 26, rotate: -0.35 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      console.error('Error fetching stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-10 lg:space-y-14"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Hero — asymmetric, overlaps visual rhythm */}
      <motion.section
        variants={item}
        className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-br from-secondary via-secondary/95 to-secondary/80 p-8 text-primary-foreground shadow-brutal-lg md:p-10 lg:p-12"
      >
        <div
          className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rotate-12 rounded-3xl border-2 border-primary-foreground/15"
          aria-hidden
        />
        <div className="relative max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground/70">
            Dashboard
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl lg:text-[2.35rem]">
            Welcome back, {session?.user?.name || 'there'}.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-primary-foreground/88">
            Automate Greenhouse applications with your saved template—sharp,
            fast, and under your control.
          </p>
        </div>
      </motion.section>

      <div className="grid gap-10 lg:grid-cols-[1fr_min(340px,32%)] lg:items-start lg:gap-12">
        <motion.section
          variants={item}
          className="relative -mt-4 rounded-3xl border-2 border-border bg-card p-6 shadow-brutal md:p-8 lg:-mt-8"
        >
          <div className="absolute -left-1 top-8 hidden h-24 w-1 rounded-full bg-gradient-to-b from-primary to-accent lg:block" />
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground md:text-2xl">
              <FileText className="h-7 w-7 text-primary" />
              Application template
            </h2>
            <Link
              href="/dashboard/template"
              className="text-sm font-semibold text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary"
            >
              {template ? 'Edit template' : 'Create template'}
            </Link>
          </div>

          {template ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-secondary/25 bg-secondary/10 p-4">
                <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-secondary" />
                <div>
                  <p className="font-medium text-foreground">Template is ready</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saved and ready for job applications.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['Full name', template.fullName],
                  ['Email', template.email],
                  ['Resume', template.resumeFileName || 'Not uploaded'],
                  ['Years experience', template.yearsExperience ?? 'Not specified'],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    className="rounded-2xl border border-border/80 bg-muted/30 p-4 transition-colors hover:bg-muted/45"
                  >
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {k}
                    </p>
                    <p className="mt-1 font-medium text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-5">
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-foreground">No template yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your application template to start applying.
                </p>
                <Link
                  href="/dashboard/template"
                  className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-brutal transition hover:-translate-y-0.5 hover:rotate-[-0.5deg] hover:shadow-lg"
                >
                  Create template now
                </Link>
              </div>
            </div>
          )}
        </motion.section>

        <motion.div variants={item} className="space-y-4">
          {(
            [
              ['Total', stats.total, FileText, 'text-primary', 'bg-primary/12'],
              ['Success', stats.success, CheckCircle, 'text-secondary', 'bg-secondary/15'],
              ['Failed', stats.failed, AlertCircle, 'text-destructive', 'bg-destructive/10'],
              ['Manual', stats.manual, AlertCircle, 'text-accent', 'bg-accent/20'],
            ] as const
          ).map(([label, value, Icon, color, bg]) => (
            <motion.div
              key={label}
              variants={item}
              whileHover={{ y: -4, rotate: -0.4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="flex items-center justify-between rounded-2xl border-2 border-border bg-card px-5 py-4 shadow-sm"
            >
              <div>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className={`mt-1 text-3xl font-display font-semibold tabular-nums ${color}`}>
                  {value}
                </p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}
              >
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <motion.section variants={item} className="grid gap-6 md:grid-cols-2">
        <Link
          href="/dashboard/apply"
          className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-8 shadow-brutal transition-all duration-normal hover:-translate-y-1 hover:border-primary/35 hover:shadow-brutal-lg"
        >
          <div className="absolute -right-6 top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="relative flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 transition-transform duration-normal group-hover:scale-105 group-hover:rotate-3">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Apply to jobs
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit applications automatically
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/history"
          className="group relative overflow-hidden rounded-3xl border-2 border-border bg-card p-8 shadow-brutal transition-all duration-normal hover:-translate-y-1 hover:border-secondary/40 hover:shadow-brutal-lg"
        >
          <div className="absolute -right-6 top-6 h-24 w-24 rounded-full bg-secondary/10 blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="relative flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/12 transition-transform duration-normal group-hover:scale-105 group-hover:-rotate-3">
              <FileText className="h-7 w-7 text-secondary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground">
                View history
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Track every application
              </p>
            </div>
          </div>
        </Link>
      </motion.section>
    </motion.div>
  );
}
