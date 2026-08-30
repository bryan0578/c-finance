'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle, logout } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { CFinanceLogo } from '@/components/brand/c-finance-logo';
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
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:block" />
    );
  }

  return (
    <aside className="hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-card/95 md:flex">
      <div className="border-b border-border px-6 py-5">
        <Link href="/dashboard" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex items-center gap-3">
            <CFinanceLogo className="h-10 w-10" priority />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                C-Finance
              </h1>
              <p className="text-xs text-muted-foreground">Private finance workspace</p>
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1.5 px-4 py-4">
        {user ? (
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <span className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-primary/12 text-primary' : 'bg-secondary/70 text-muted-foreground group-hover:text-foreground'
                )}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })
        ) : (
          <div className="px-3 text-sm text-muted-foreground">
            Please sign in to manage your finances.
          </div>
        )}
      </nav>

      <div className="border-t border-border px-4 py-4">
        {user ? (
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-secondary/45 px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {getUserInitial(user)}
              </div>

              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-foreground">
                  {user.displayName || 'User'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="min-h-11 w-full justify-start rounded-xl border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        ) : (
          <Button
            className="min-h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
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
