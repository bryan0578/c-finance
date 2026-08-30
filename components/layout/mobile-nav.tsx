'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarSync, LayoutDashboard, LogOut, Menu, Receipt, Wallet } from 'lucide-react';

import { logout } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CFinanceLogo } from '@/components/brand/c-finance-logo';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Bills & Subs', href: '/bills', icon: CalendarSync },
  { name: 'Budgets', href: '/budgets', icon: Wallet },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-[calc(4rem+env(safe-area-inset-top))] items-end justify-between border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
      <Link href="/dashboard" className="flex min-h-11 items-center gap-2 font-semibold text-foreground">
        <CFinanceLogo className="h-9 w-9" priority />
        <span className="tracking-tight">C-Finance</span>
      </Link>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="h-11 w-11 border-border bg-card text-foreground" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[min(88vw,320px)] border-border bg-popover p-0 text-popover-foreground">
          <div className="border-b border-border px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <SheetTitle className="flex items-center gap-2 text-popover-foreground">
              <CFinanceLogo className="h-8 w-8" />
              C-Finance
            </SheetTitle>
            <p className="mt-1 text-sm text-muted-foreground">Your finance command center</p>
          </div>
          <nav className="space-y-2 p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="absolute inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              className="min-h-11 w-full justify-start border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
