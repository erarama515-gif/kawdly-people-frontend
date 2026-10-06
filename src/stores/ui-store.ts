import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '../i18n';
import { STORAGE_KEYS, type Language } from '../lib/language';

interface UiState {
  /** Desktop sidebar collapsed to icon rail. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;

  /** Mobile sidebar drawer. */
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  /** Currently expanded accordion group id (single open group). */
  openGroupId: string | null;
  setOpenGroupId: (groupId: string | null) => void;

  /** Group whose collapsed-rail flyout is open (single flyout at a time). */
  flyoutGroupId: string | null;
  setFlyoutGroupId: (groupId: string | null) => void;

  /** Command palette. */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  language: Language;
  setLanguage: (language: Language) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      mobileSidebarOpen: false,
      openMobileSidebar: () => set({ mobileSidebarOpen: true }),
      closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

      openGroupId: null,
      setOpenGroupId: (openGroupId) => set({ openGroupId }),

      flyoutGroupId: null,
      setFlyoutGroupId: (flyoutGroupId) => set({ flyoutGroupId }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

      language: i18n.language === 'en' ? 'en' : 'ar',
      // Await the i18n change so the document direction (and loaded strings) are
      // applied before the store flips — the direction-driven UI then re-renders
      // against a consistent direction and geometry instead of the previous one.
      setLanguage: async (language) => {
        await i18n.changeLanguage(language);
        set({ language });
      },
    }),
    {
      name: STORAGE_KEYS.ui,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        language: state.language,
      }),
    },
  ),
);
