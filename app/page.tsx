'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { CFinanceLogo } from '@/components/brand/c-finance-logo';
import {
  LogIn,
  ShieldCheck,
  Wallet,
  Receipt,
  CalendarSync,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signInError, setSignInError] = useState('');

  async function handleSignIn() {
    try {
      setSignInError('');
      await loginWithGoogle();
    } catch {
      setSignInError('Sign-in did not complete. Please try again.');
    }
  }

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Loading C-Finance...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center px-6 pb-[max(4rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] md:px-10">
        <div className="mx-auto w-full max-w-3xl text-center">
          <CFinanceLogo className="mx-auto mb-6 h-24 w-24 sm:h-28 sm:w-28" priority />

          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Private personal finance workspace
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl md:text-6xl">
            See your money clearly.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Track transactions, recurring bills, budgets, and spending patterns in one focused workspace built to help you act before surprises become problems.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="min-h-12 min-w-[220px] rounded-xl bg-primary px-6 text-primary-foreground hover:bg-primary/90"
              onClick={handleSignIn}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>

            <span className="text-sm text-muted-foreground">
              One account · one private workspace
            </span>
          </div>

          {signInError && (
            <p className="mt-3 text-sm text-destructive" role="alert">{signInError}</p>
          )}
        </div>

        <div className="mx-auto mt-14 grid w-full max-w-5xl gap-4 md:grid-cols-3">
          <FeatureCard
            icon={Wallet}
            title="Know your position"
            description="See income, expenses, net balance, and budget pressure without digging through separate views."
          />
          <FeatureCard
            icon={Receipt}
            title="Understand the activity"
            description="Search and review transactions, categories, recurring matches, duplicates, and items that need attention."
          />
          <FeatureCard
            icon={CalendarSync}
            title="Stay ahead of due dates"
            description="Keep recurring bills and subscriptions visible, including partial payments and upcoming obligations."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Wallet;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/90 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.14)]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/20">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
