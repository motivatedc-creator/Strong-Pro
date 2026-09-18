import { defaultQuickIncrementG } from '@/domain/units';
import type { AppSettings } from '@/domain/types';

/** Fresh-install defaults. Stamp is the Lock'd ink/paper accent (not ember gold). */
export function defaultSettings(now: string): AppSettings {
  return {
    id: 'settings',
    unitSystem: 'metric',
    oneRepMaxFormula: 'epley',
    intensityMode: 'rpe',
    quickIncrementG: defaultQuickIncrementG('metric'),
    defaultRestSeconds: 120,
    restTimerAutoStart: true,
    restTimerSound: true,
    restTimerVibrate: true,
    restTimerNotification: false,
    excludeWarmupsFromAnalytics: true,
    secondaryMuscleCredit: 0.5,
    personalMuscleTargets: {},
    defaultBarProfileId: 'seed-bar-olympic-kg',
    defaultPlateInventoryId: 'seed-plates-kg',
    themeMode: 'system',
    accentTheme: 'stamp',
    appIcon: 'default',
    updatedAt: now,
  };
}
