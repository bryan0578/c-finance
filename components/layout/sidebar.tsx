'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Bills & Subs', href: '/bills', icon: CalendarSync },
  { name: 'Budgets', href: '/budgets', icon: Wallet },
];

function getUserInitial(user: { displayName?: string | null; email?: string | null }) {
  if (user.displayName?.trim()) {
    return user.displayName.trim()[0].toUpperCase();
  }

  if (user.email?.trim()) {
    return user.email.trim()[0].toUpperCase();
  }

  return 'U';
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) {
    return <aside className="w-64 shrink-0 bg-white border-r" />;
  }

  return (
    <aside className="w-64 shrink-0 bg-white border-r flex flex-col min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          Finance AI
        </h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {user ? (
          navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })
        ) : (
          <div className="text-sm text-gray-500 px-3">
            Please log in to manage your finances.
          </div>
        )}
      </nav>

      <div className="p-4 border-t">
        {user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium shrink-0">
                {getUserInitial(user)}
              </div>

              <div className="text-sm min-w-0">
                <p className="font-medium truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={loginWithGoogle}>
            <LogIn className="w-4 h-4 mr-2" />
            Log in with Google
          </Button>
        )}
      </div>
    </aside>
  );
}