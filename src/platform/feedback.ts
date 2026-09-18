/**
 * Sound, vibration and web notifications for the rest timer.
 * Every capability is optional and probed at call time — a silent device, a browser
 * without the Vibration API, or a denied notification permission never breaks logging.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/** Short two-tone chime, synthesised so the app ships no audio assets. */
export function playChime(): void {
  const context = getAudioContext();
  if (!context) return;
  try {
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    }
  } catch {
    // Autoplay policy or an unavailable device — the visual timer is the primary cue.
  }
}

export function vibrate(pattern: number | number[] = [120, 60, 120]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (iOS Safari) — ignore.
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Fires immediately; only useful while the page is alive (see platform/capacitor.ts). */
export function showWebNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/brand/favicon.svg', tag: 'lockd-rest-timer' });
  } catch {
    // Some browsers require a service-worker registration for notifications; ignore.
  }
}
