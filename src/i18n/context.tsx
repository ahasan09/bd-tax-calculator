import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createI18n, LANGS, type I18n, type Lang } from './index';

const STORAGE_KEY = 'bdtax.lang';

// Saved choice, else Bangla on a Bangla-language system, else English.
// Storage can be blocked (private mode) — the page works without it.
function preferredLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved as Lang)) return saved as Lang;
  } catch { /* storage blocked */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some(l => /^bn\b/i.test(l || '')) ? 'bn' : 'en';
}

interface LangContext { i18n: I18n; setLang: (lang: Lang) => void }
const Ctx = createContext<LangContext | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(preferredLang);
  const i18n = useMemo(() => createI18n(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = i18n.t('app.title');
  }, [lang, i18n]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* not saved — fine */ }
  };
  return <Ctx.Provider value={{ i18n, setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): LangContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
