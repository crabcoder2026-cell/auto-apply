'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      <div
        className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-secondary via-secondary/95 to-secondary/80 p-12 text-primary-foreground lg:flex xl:p-16"
        aria-hidden
      >
        <div className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 left-10 h-40 w-40 rotate-12 rounded-3xl border-2 border-primary-foreground/20" />
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary-foreground/65">
            Auto Apply
          </p>
          <h2 className="mt-6 max-w-md font-display text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">
            Open doors without opening fifty tabs.
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-primary-foreground/75">
          Greenhouse applications, templated and tracked, built for momentum, not
          busywork.
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-14 hero-gradient">
        <div className="pointer-events-none absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl lg:hidden" />
        <motion.div
          initial={{ opacity: 0, y: 28, rotate: -0.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md space-y-8 rounded-3xl border-2 border-border bg-card/95 p-8 shadow-brutal backdrop-blur-sm sm:p-10"
        >
          <div className="text-center">
            <motion.div
              className="mb-5 flex justify-center"
              whileHover={{ scale: 1.04, rotate: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <Image
                src="/logo.png"
                alt="7 Apply"
                width={72}
                height={72}
                className="h-16 w-16 rounded-2xl border border-border/80 object-contain shadow-sm"
                priority
              />
            </motion.div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Welcome back
            </h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to your Auto Apply account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border-2 border-input bg-background py-2.5 pl-10 pr-3 text-foreground transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-input bg-background py-2.5 pl-10 pr-3 text-foreground transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01, rotate: -0.3 }}
              whileTap={{ scale: 0.99 }}
              className="flex w-full items-center justify-center rounded-xl border-2 border-transparent bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-brutal transition hover:bg-primary/92 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in
                </>
              ) : (
                'Sign in'
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
            >
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
