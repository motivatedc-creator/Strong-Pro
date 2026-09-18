import { useEffect } from 'react';
import { useSettings } from '@/app/SettingsProvider';
import { useTicker, useVisibilityRefresh } from '@/app/hooks';
import { Button, IconButton, cx } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { formatDuration } from '@/domain/units';
import {
  describeTimer,
  isExpired,
  remainingSeconds,
  timerProgress,
  useRestTimerStore,
} from './restTimer';

/**
 * Floating rest-timer bar. Visible on every route while a timer runs, so leaving the
 * workout screen to check history or run the plate calculator never loses the rest.
 */
export function RestTimerBar() {
  const timer = useRestTimerStore((state) => state.timer);
  const adjust = useRestTimerStore((state) => state.adjust);
  const stop = useRestTimerStore((state) => state.stop);
  const announce = useRestTimerStore((state) => state.announce);
  const hydrate = useRestTimerStore((state) => state.hydrate);
  const { settings } = useSettings();

  const tick = useTicker(!!timer, 250);
  useVisibilityRefresh(() => void hydrate());

  const expired = isExpired(timer, tick);
  const seconds = remainingSeconds(timer, tick);

  useEffect(() => {
    if (!expired) return;
    announce({
      sound: settings.restTimerSound,
      vibration: settings.restTimerVibrate,
      notification: settings.restTimerNotification,
    });
  }, [
    expired,
    announce,
    settings.restTimerSound,
    settings.restTimerVibrate,
    settings.restTimerNotification,
  ]);

  if (!timer) return null;

  const progress = timerProgress(timer, tick);

  return (
    <div
      className={cx(
        'fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg px-3 lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm lg:px-0',
      )}
    >
      <div
        className={cx('overflow-hidden rounded-2xl', expired ? 'bg-success/15' : 'bg-surface')}
        style={{ boxShadow: 'var(--shadow-border)' }}
      >
        <div
          aria-hidden="true"
          className={cx(
            'h-1 transition-[width] duration-200',
            expired ? 'bg-success' : 'bg-accent',
          )}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <Icon icon={expired ? Icons.check : Icons.timer} size={14} />
              {expired ? 'Rest complete' : 'Resting'}
              {timer.label && <span className="truncate text-ink-subtle">· {timer.label}</span>}
            </p>
            <p
              className={cx(
                'text-xl font-bold tabular-nums',
                expired ? 'text-success' : 'text-ink',
              )}
            >
              {formatDuration(seconds)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              label="Subtract 15 seconds"
              onClick={() => void adjust(-15)}
              variant="secondary"
            >
              <span aria-hidden="true" className="text-xs font-bold">
                −15
              </span>
            </IconButton>
            <IconButton label="Add 15 seconds" onClick={() => void adjust(15)} variant="secondary">
              <span aria-hidden="true" className="text-xs font-bold">
                +15
              </span>
            </IconButton>
            <Button size="sm" variant={expired ? 'success' : 'primary'} onClick={() => void stop()}>
              {expired ? 'Done' : 'Skip'}
            </Button>
          </div>
        </div>
      </div>
      <p aria-live="polite" className="rf-sr-only">
        {describeTimer(timer)}
      </p>
    </div>
  );
}
