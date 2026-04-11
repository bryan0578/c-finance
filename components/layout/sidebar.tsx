'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle, logout } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Receipt,
  CalendarSync,
  Wallet,
  LogOut,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Bills & Subs', href: '/bills', icon: CalendarSync },
  { name: 'Budgets', href: '/budgets', icon: Wallet },
];

function getUserInitial(user: {
  displayName?: string | null;
  email?: string | null;
}) {
  return (user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      router.replace('/dashboard');
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  if (loading) {
    return (
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block" />
    );
  }

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-200 px-6 py-5">
        <Link href="/dashboard" className="block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900">
                Finance AI
              </h1>
              <p className="text-xs text-slate-500">Personal finance workspace</p>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-4">
        {user ? (
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })
        ) : (
          <div className="px-3 text-sm text-slate-500">
            Please sign in to manage your finances.
          </div>
        )}
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        {user ? (
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {getUserInitial(user)}
              </div>

              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-slate-900">
                  {user.displayName || 'User'}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start rounded-md border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4 cursor" />
              Log out
            </Button>
          </div>
        ) : (
          <Button
            className="w-full rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={handleLogin}
          >
            <LogIn className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
        )}
      </div>
    </aside>
  );
}