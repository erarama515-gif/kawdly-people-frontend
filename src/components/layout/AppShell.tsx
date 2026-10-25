import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useSetupStatus } from '@/features/setup/api/setup';
import { CommandPalette } from './CommandPalette';
import { TopBar } from './TopBar';

/**
 * Offers the first-run wizard exactly once per browser profile.
 *
 * A fresh install lands on a dashboard of zeros. We auto-open the wizard the
 * first time a user who can actually complete it (company-edit permission)
 * sees the shell, then never again - the route stays reachable from Settings
 * and the founder can dismiss it from the wizard itself (A1.6).
 */
const SETUP_OFFERED_KEY = 'kawdly-people-setup-offered';

function useFirstRunSetupOffer(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useSetupStatus();

  useEffect(() => {
    if (state.status !== 'success') return;

    const status = state.data;
    if (!status?.needs_setup || !status.can_manage || pathname === '/setup') return;

    try {
      if (window.localStorage.getItem(SETUP_OFFERED_KEY) === '1') return;
      window.localStorage.setItem(SETUP_OFFERED_KEY, '1');
    } catch {
      return; // storage unavailable: better to stay put than to nag every visit
    }

    navigate('/setup', { replace: true });
  }, [state.status, state.data, pathname, navigate]);
}

export function AppShell() {
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement>(null);

  useFirstRunSetupOffer();

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