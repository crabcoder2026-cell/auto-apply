'use client';

import { signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Send, History, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: FileText },
    { href: '/dashboard/apply', label: 'Apply to Jobs', icon: Send },
    { href: '/dashboard/history', label: 'History', icon: History },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center min-h-[5rem] sm:min-h-[5.25rem] py-2">
          <div className="flex items-center min-w-0 flex-1 mr-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 sm:gap-4 min-w-0"
            >
              <Image
                src="/logo.png"
                alt="7 Apply"
                width={88}
                height={88}
                className="h-[4.25rem] w-[4.25rem] sm:h-20 sm:w-20 shrink-0 object-contain rounded-lg"
                priority
              />
              <div className="min-w-0 flex flex-col justify-center gap-0.5">
                <span className="text-base sm:text-lg font-bold text-brand-green tracking-tight leading-none hidden sm:block">
                  Auto Apply
                </span>
                <p className="text-[11px] sm:text-xs lg:text-sm text-gray-600 leading-snug max-w-[14rem] sm:max-w-[18rem] lg:max-w-none hidden md:block">
                Jobs don’t sleep. Neither do we{' '}
                  <span className="text-brand-orange font-semibold whitespace-nowrap">
                    Just Like 7-eeeeeeeeeeeeeeeee
                  </span>
                </p>
              </div>
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-green-muted text-brand-green ring-1 ring-brand-green/20'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-brand-green'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-brand-green transition-colors ml-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-brand-green hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-inner">
          <p className="px-4 py-3 text-xs text-gray-600 border-b border-gray-100 leading-relaxed">
           Jobs don’t sleep. Neither do we{' '}
            <span className="text-brand-orange font-semibold">Just Like 7-eeeeeeeeeee</span>
          </p>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-green-muted text-brand-green'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
