'use client';

import { signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Send,
  History,
  LogOut,
  Menu,
  X,
  Gauge,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FileText },
    { href: '/dashboard/apply', label: 'Apply to Jobs', icon: Send },
    { href: '/dashboard/auto-search', label: 'Auto Search', icon: Search },
    { href: '/dashboard/watch', label: 'Auto pilot', icon: Gauge },
    { href: '/dashboard/history', label: 'History', icon: History },
  ];

  return (
    <nav className="relative border-b border-border/70 bg-card/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[4.75rem] items-center justify-between gap-4 py-3 sm:min-h-[5rem]">
          <div className="flex min-w-0 flex-1 items-center">
            <Link
              href="/dashboard"
              className="group flex min-w-0 items-center gap-3 sm:gap-4"
            >
              <motion.div
                whileHover={{ rotate: -2.5, scale: 1.03 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="relative shrink-0"
              >
                <div
                  className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/30 via-transparent to-accent/25 opacity-0 blur-sm transition-opacity duration-normal group-hover:opacity-100"
                  aria-hidden
                />
                <Image
                  src="/logo.png"
                  alt="7 Apply"
                  width={88}
                  height={88}
                  className="relative h-[3.75rem] w-[3.75rem] rounded-xl border border-border/60 bg-card object-contain shadow-brutal sm:h-[4.25rem] sm:w-[4.25rem]"
                  priority
                />
              </motion.div>
              <div className="hidden min-w-0 flex-col justify-center gap-1 sm:flex">
                <span className="font-display text-lg font-semibold leading-none tracking-tight text-foreground md:text-xl">
                  Auto Apply
                </span>
                <p className="max-w-[18rem] text-[11px] leading-snug text-muted-foreground md:max-w-[20rem] md:text-xs lg:max-w-none">
                  Jobs don&apos;t sleep. Neither do we{' '}
                  <span className="font-medium text-primary">Just Like 7</span>
                </p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-1 md:flex md:pl-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-fast',
                      isActive
                        ? 'bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="ml-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-fast hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl border border-border/80 bg-muted/40 p-2.5 text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border/60 bg-card/95 backdrop-blur-md md:hidden"
        >
          <p className="border-b border-border/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Jobs don&apos;t sleep. Neither do we{' '}
            <span className="font-medium text-primary">Just Like 7</span>
          </p>
          <div className="space-y-1 px-2 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/12 text-primary ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
