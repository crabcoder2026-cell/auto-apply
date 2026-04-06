'use client';

import type { ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export function ApplicationStatusBadge({ status }: { status: string }) {
  const badges: Record<string, ReactNode> = {
    success: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 shrink-0" />
        Success
      </span>
    ),
    failed: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 shrink-0" />
        Failed
      </span>
    ),
    requires_manual: (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <AlertCircle className="h-3 w-3 shrink-0" />
        Manual
      </span>
    ),
    skipped: (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <AlertCircle className="h-3 w-3 shrink-0" />
        Skipped
      </span>
    ),
  };

  return <>{badges[status] ?? badges.skipped}</>;
}
