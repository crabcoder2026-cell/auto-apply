import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function AuthLayout({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="hero-gradient relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rotate-6 rounded-3xl border-2 border-secondary/20 bg-secondary/5"
        aria-hidden
      />
      <Card
        className={cn(
          'relative w-full max-w-md border-2 border-border bg-card/95 shadow-brutal backdrop-blur-sm',
          className
        )}
      >
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-base text-muted-foreground">
              {description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
