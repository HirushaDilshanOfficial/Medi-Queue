import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate, type Language, type TranslationValues } from './translations';
export { translate, type Language } from './translations';

export const LANGUAGE_STORAGE_KEY = 'mediqueue_language';
export const LANGUAGES: readonly { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'si', name: 'සිංහල' },
  { code: 'ta', name: 'தமிழ்' },
];

type LanguageValue = {
  language: Language;
  ready: boolean;
  setLanguage: (language: Language) => Promise<void>;
  t: (text: string, values?: TranslationValues) => string;
  locale: string;
};
const LanguageContext = createContext<LanguageValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then(saved => {
      if (active && (saved === 'en' || saved === 'si' || saved === 'ta')) updateLanguage(saved);
    }).catch(() => {
      // Keep English usable if device storage is unavailable.
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (next: Language) => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    updateLanguage(next);
  }, []);
  const t = useCallback((text: string, values?: TranslationValues) => translate(language, text, values), [language]);
  const value = useMemo(() => ({ language, ready, setLanguage, t,
    locale: language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-GB',
  }), [language, ready, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
