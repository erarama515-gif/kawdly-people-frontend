import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { getNavEntries, pathById } from '@/config/navigation';
import { useUiStore } from '@/stores/ui-store';

const EMPLOYEES_PATH = pathById('employees');

/** Mock employees for the palette. Names are localized, navigation is real. */
const MOCK_EMPLOYEES = [
  { id: 'e1', ar: 'أحمد علي حسن', en: 'Ahmed Ali Hassan', role: { ar: 'مهندس برمجيات أول', en: 'Senior Engineer' } },
  { id: 'e2', ar: 'منى سعيد', en: 'Mona Said', role: { ar: 'أخصائية موارد بشرية', en: 'HR Specialist' } },
  { id: 'e3', ar: 'عمر فؤاد', en: 'Omar Fouad', role: { ar: 'محاسب أول', en: 'Senior Accountant' } },
  { id: 'e4', ar: 'سلمى يوسف', en: 'Salma Youssef', role: { ar: 'مديرة التوظيف', en: 'Recruiting Manager' } },
  { id: 'e5', ar: 'خالد نبيل', en: 'Khaled Nabil', role: { ar: 'مهندس دعم تقني', en: 'Support Engineer' } },
] as const;

const pageItemClass =
  'flex h-11 cursor-pointer select-none items-center gap-3 rounded-[3px] px-3 text-body-sm text-ink outline-none transition-colors duration-150 data-[selected=true]:bg-surface-hover';

const employeeItemClass =
  'flex h-12 cursor-pointer select-none flex-col justify-center rounded-[3px] px-3 py-2 text-body-sm text-ink outline-none transition-colors duration-150 data-[selected=true]:bg-surface-hover';

const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-muted';

export function CommandPalette() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const open = useUiStore((state) => state.commandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);

  const isArabic = i18n.language === 'ar';
  const entries = getNavEntries();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(7,45,74,0.45)]" />
        <Dialog.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="fixed inset-x-0 top-[84px] z-50 mx-auto w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[3px] border border-hairline bg-surface focus:outline-none data-[state=open]:animate-content-in"
        >
          <Dialog.Title className="sr-only">{t('palette.title')}</Dialog.Title>
          <Dialog.Description className="sr-only">{t('palette.hint')}</Dialog.Description>

          <Command label={t('palette.title')} className="flex flex-col">
            <div className="flex h-12 items-center gap-2.5 border-b border-divider px-4">
              <Search className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder={t('palette.placeholder')}
                className="h-full w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
              />
            </div>

            <Command.List className="scrollbar-slim max-h-[360px] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-10 text-center text-body-sm text-ink-muted">
                {t('palette.empty')}
              </Command.Empty>

              <Command.Group className={groupClass} heading={t('palette.groups.pages')}>
                {entries.map((entry) => (
                  <Command.Item
                    key={entry.path}
                    value={`${t(`nav.${entry.id}`)} ${entry.path}`}
                    onSelect={() => goTo(entry.path)}
                    className={pageItemClass}
                  >
                    <entry.icon
                      className="h-4 w-4 shrink-0 text-ink-faint"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="truncate">{t(`nav.${entry.id}`)}</span>
                    <span className="nums ms-auto hidden shrink-0 text-caption text-ink-faint sm:inline">
                      {entry.path}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group className={groupClass} heading={t('palette.groups.employees')}>
                {MOCK_EMPLOYEES.map((employee) => (
                  <Command.Item
                    key={employee.id}
                    value={`${isArabic ? employee.ar : employee.en} ${isArabic ? employee.role.ar : employee.role.en}`}
                    onSelect={() => goTo(EMPLOYEES_PATH)}
                    className={employeeItemClass}
                  >
                    <span className="truncate">{isArabic ? employee.ar : employee.en}</span>
                    <span className="truncate text-caption text-ink-muted">
                      {isArabic ? employee.role.ar : employee.role.en}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
