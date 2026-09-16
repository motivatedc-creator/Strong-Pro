import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultSettings, getRepository } from '@/db/dexieRepository';
import type { AppSettings } from '@/domain/types';
import { lengthUnitFor, weightUnitFor, type LengthUnit, type WeightUnit } from '@/domain/units';
import { applyTheme, watchSystemTheme } from '@/platform/theme';
import { nowIso } from '@/domain/time';

interface SettingsContextValue {
  settings: AppSettings;
  weightUnit: WeightUnit;
  lengthUnit: LengthUnit;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  ready: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => defaultSettings(nowIso()));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .getSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        applyTheme({ mode: loaded.themeMode, accent: loaded.accentTheme });
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow the OS when the user chose "system".
  useEffect(() => {
    if (settings.themeMode !== 'system') return;
    return watchSystemTheme(() => applyTheme({ mode: 'system', accent: settings.accentTheme }));
  }, [settings.themeMode, settings.accentTheme]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await getRepository().updateSettings(patch);
    setSettings(next);
    if (patch.themeMode !== undefined || patch.accentTheme !== undefined) {
      applyTheme({ mode: next.themeMode, accent: next.accentTheme });
    }
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      weightUnit: weightUnitFor(settings.unitSystem),
      lengthUnit: lengthUnitFor(settings.unitSystem),
      update,
      ready,
    }),
    [settings, update, ready],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside SettingsProvider');
  return context;
}
