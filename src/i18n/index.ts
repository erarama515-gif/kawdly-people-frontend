import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';
import { applyDocumentLanguage, readStoredLanguage } from '../lib/language';

export const resources = {
  ar: { translation: ar },
  en: { translation: en },
} as const;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: readStoredLanguage(),
    fallbackLng: 'en',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language === 'en' ? 'en' : 'ar');
});

applyDocumentLanguage(readStoredLanguage());

export default i18n;
