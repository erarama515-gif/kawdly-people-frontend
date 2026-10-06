import { useUiStore } from '@/stores/ui-store';

/** Current text direction. Drives icon flipping and physical-only library APIs. */
export function useDirection(): 'rtl' | 'ltr' {
  const language = useUiStore((state) => state.language);
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function useIsRtl(): boolean {
  return useDirection() === 'rtl';
}
