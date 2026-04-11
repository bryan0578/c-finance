'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  LogIn,
  Sparkles,
  Wallet,
  Receipt,
  CalendarSync,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 md:px-10">
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm text-indigo-700">
            <Sparkles className="mr-2 h-4 w-4" />
            Your personal finance copilot
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Take control of your money without the spreadsheet circus
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Track transactions, stay ahead of recurring bills, monitor your budget,
            and get AI-powered insights that actually help you make better decisions.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="min-w-[220px] rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={loginWithGoogle}
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>

            <div className="inline-flex items-center text-sm text-slate-500">
              Quick setup
              <ArrowRight className="ml-1 h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-14 grid w-full max-w-5xl gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <Wallet className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Track balances</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Get a clear view of your income, expenses, and net balance without
              digging through multiple screens.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <Receipt className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Understand spending</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Organize transactions by category so you can spot patterns, leaks,
              and habits before they become expensive hobbies.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <CalendarSync className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Stay ahead of bills</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep recurring payments visible so due dates do not show up out of
              nowhere like a surprise album drop from your bank account.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}