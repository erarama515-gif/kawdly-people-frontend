import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Languages, LogOut, Settings, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsRtl } from '@/hooks/useDirection';
import { useUiStore } from '@/stores/ui-store';
import { pathById } from '@/config/navigation';
import { currentUser } from '@/config/currentUser';
import { Avatar } from '@/components/ui/Avatar';
import type { Language } from '@/lib/language';

const menuItemClass =
  'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[3px] px-3 text-body-sm text-ink outline-none transition-colors duration-150 data-[highlighted]:bg-surface-hover';

const separatorClass = 'my-1 h-px bg-divider';

export function UserMenu() {
  const { t } = useTranslation();
  const isRtl = useIsRtl();
  const navigate = useNavigate();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const isArabic = language === 'ar';
  const identity = {
    name: isArabic ? currentUser.name.ar : currentUser.name.en,
    initials: isArabic ? currentUser.initials.ar : currentUser.initials.en,
  };

  // Radix places overlays physically, so the alignment follows the current direction.
  const alignToButton = isRtl ? 'start' : 'end';

  const chooseLanguage = (next: Language) => {
    setLanguage(next);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={identity.name}
          className="grid shrink-0 place-items-center rounded-full transition-opacity duration-150 hover:opacity-90"
        >
          <Avatar
            initials={identity.initials}
            photo={currentUser.photo}
            size={32}
            className="border-2 border-navy outline outline-2 outline-surface"
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={alignToButton}
          sideOffset={8}
          collisionPadding={8}
          className="z-50 w-[240px] rounded-[3px] border border-hairline bg-surface p-1 focus:outline-none data-[state=open]:animate-content-in"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-body-sm font-semibold text-ink">{identity.name}</p>
            <p className="nums mt-0.5 truncate text-start text-caption text-ink-muted" dir="ltr">
              {currentUser.email}
            </p>
          </div>

          <DropdownMenu.Separator className={separatorClass} />

          <DropdownMenu.Item className={cn(menuItemClass)}>
            <UserRound className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden="true" />
            {t('userMenu.profile')}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={cn(menuItemClass)}
            onSelect={() => navigate(pathById('settings'))}
          >
            <Settings className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden="true" />
            {t('nav.settings')}
          </DropdownMenu.Item>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={cn(menuItemClass, 'data-[state=open]:bg-surface-hover')}>
              <Languages className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1">{t('userMenu.language')}</span>
              <span className="rtl:-scale-x-100">
                <ChevronLeft className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden="true" />
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                collisionPadding={8}
                className="z-50 min-w-[180px] rounded-[3px] border border-hairline bg-surface p-1 focus:outline-none"
              >
                <DropdownMenu.RadioGroup
                  value={language}
                  onValueChange={(value) => chooseLanguage(value as Language)}
                >
                  <LanguageOption value="ar" label={t('userMenu.languageArabic')} />
                  <LanguageOption value="en" label={t('userMenu.languageEnglish')} />
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className={separatorClass} />

          <DropdownMenu.Item className={cn(menuItemClass, 'text-coral')}>
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {t('userMenu.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function LanguageOption({ value, label }: { value: Language; label: string }) {
  return (
    <DropdownMenu.RadioItem value={value} className={cn(menuItemClass, 'justify-between gap-4')}>
      <span>{label}</span>
      <DropdownMenu.ItemIndicator>
        <Check className="h-4 w-4 text-navy" strokeWidth={2} aria-hidden="true" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}