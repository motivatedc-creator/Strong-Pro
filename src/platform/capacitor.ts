import type { AppIcon } from '@/domain/types';

/**
 * Capacitor bridge.
 *
 * The web build must not depend on Capacitor being present, so every call goes through a
 * runtime feature check against the globals Capacitor injects. Nothing here fails the app
 * when it runs as a plain PWA — each function reports honestly whether it did anything.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
}

interface AlternateIconPlugin {
  /** Supported on iOS 10.3+ via UIApplication.setAlternateIconName. */
  change?: (options: { name: string | null }) => Promise<unknown>;
  supportsAlternateIcons?: () => Promise<{ value: boolean }>;
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return capacitor()?.isNativePlatform?.() === true;
}

export function platform(): 'ios' | 'android' | 'web' {
  const name = capacitor()?.getPlatform?.();
  return name === 'ios' || name === 'android' ? name : 'web';
}

export type IconSwitchResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported-platform' | 'plugin-missing' | 'failed' };

/**
 * Switches the home-screen icon.
 *
 * iOS exposes `setAlternateIconName`, which the `capacitor-alternate-icon` style plugin
 * surfaces as `AlternateIcon.change`. Android and the web have no runtime icon API at all:
 * the installed PWA icon comes from the manifest and only changes on reinstall. This
 * returns why it could not switch rather than pretending it worked.
 */
export async function setAppIcon(icon: AppIcon): Promise<IconSwitchResult> {
  if (platform() !== 'ios') return { ok: false, reason: 'unsupported-platform' };

  const plugin = capacitor()?.Plugins?.['AlternateIcon'] as AlternateIconPlugin | undefined;
  if (!plugin?.change) return { ok: false, reason: 'plugin-missing' };

  try {
    const supported = await plugin.supportsAlternateIcons?.();
    if (supported && supported.value === false)
      return { ok: false, reason: 'unsupported-platform' };
    // `null` restores the primary icon; named icons must exist in the iOS asset catalogue.
    await plugin.change({ name: icon === 'default' ? null : `AppIcon-${icon}` });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

export function canSwitchAppIconAtRuntime(): boolean {
  return (
    platform() === 'ios' &&
    !!(capacitor()?.Plugins?.['AlternateIcon'] as AlternateIconPlugin | undefined)?.change
  );
}

interface LocalNotificationsPlugin {
  schedule?: (options: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule?: { at: Date };
    }>;
  }) => Promise<unknown>;
  cancel?: (options: { notifications: Array<{ id: number }> }) => Promise<unknown>;
  requestPermissions?: () => Promise<{ display: string }>;
}

const REST_TIMER_NOTIFICATION_ID = 1001;

/**
 * Best-effort rest-timer notification.
 *
 * Native builds schedule a real local notification at an absolute time. On the web there
 * is no reliable background scheduler, so the browser Notification API is used only while
 * the page is alive — the timer itself is always reconstructed from a stored timestamp,
 * never from a background loop.
 */
export async function scheduleRestNotification(endsAt: Date, body: string): Promise<boolean> {
  const plugin = capacitor()?.Plugins?.['LocalNotifications'] as
    | LocalNotificationsPlugin
    | undefined;
  if (plugin?.schedule) {
    try {
      const permission = await plugin.requestPermissions?.();
      if (permission && permission.display !== 'granted') return false;
      await plugin.schedule({
        notifications: [
          {
            id: REST_TIMER_NOTIFICATION_ID,
            title: 'Rest complete',
            body,
            schedule: { at: endsAt },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function cancelRestNotification(): Promise<void> {
  const plugin = capacitor()?.Plugins?.['LocalNotifications'] as
    | LocalNotificationsPlugin
    | undefined;
  try {
    await plugin?.cancel?.({ notifications: [{ id: REST_TIMER_NOTIFICATION_ID }] });
  } catch {
    // Nothing scheduled, or no plugin — nothing to clean up.
  }
}
