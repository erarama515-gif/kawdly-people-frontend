import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { CommandPalette } from './CommandPalette';
import { TopBar } from './TopBar';

export function AppShell() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement>(null);

  // Route change scrolls the content region back to the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // The dashboard is a full-bleed page (hero + ledger) and manages its own
  // sections internally: it gets the wide 1440 content column with 48px
  // gutters, and its hero/alert band break out of the gutters via negative
  // margins. Every other page gets the standard centred 1160 wrapper.
  const isDashboard = pathname === '/';

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-page">
      <TopBar />

      <main ref={scrollRef} className="scrollbar-slim flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        {/* Keyed by pathname so only the content transitions, never the shell. */}
        <div
          key={pathname}
          className={cn(
            'animate-content-rise',
            isDashboard
              ? 'mx-auto w-full max-w-[1440px] px-4 md:px-12'
              : 'mx-auto w-full max-w-[1160px] px-4 py-8 md:px-8 lg:px-10',
          )}
        >
          <Outlet />
        </div>
      </main>

      <CommandPalette />
    </div>
  );
}