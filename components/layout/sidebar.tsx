'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { loginWithGoogle, logout } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Receipt, CalendarSync, Wallet, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Bills & Subs', href: '/bills', icon: CalendarSync },
  { name: 'Budgets', href: '/budgets', icon: Wallet },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  if (loading) return <div className="w-64 bg-white border-r hidden md:block" />;

  return (
    <div className="w-64 bg-white border-r flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">Finance AI</h1>
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
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })
        ) : (
          <div className="text-sm text-gray-500 px-3">Please log in to manage your finances.</div>
        )}
      </nav>

      <div className="p-4 border-t">
        {user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="text-sm truncate">
                <p className="font-medium">{user.displayName || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
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
    </div>
  );
}
