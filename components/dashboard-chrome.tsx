'use client';

import { motion } from 'framer-motion';
import { Navbar } from '@/components/navbar';

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-50"
      >
        {/* Decorative diagonal ribbon */}
        <div
          className="pointer-events-none absolute -right-8 top-0 z-0 h-24 w-[min(45vw,22rem)] -skew-x-12 bg-gradient-to-l from-primary/25 via-accent/15 to-transparent opacity-90"
          aria-hidden
        />
        {/* Subtle top line */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-border to-transparent"
          aria-hidden
        />
        <div className="relative z-[2]">
          <Navbar />
        </div>
      </motion.header>
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16"
      >
        {children}
      </motion.main>
    </div>
  );
}
