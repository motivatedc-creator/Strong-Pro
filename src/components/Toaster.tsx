import { useEffect } from 'react';
import { useAppStore, type Toast } from '@/app/store';
import { Button, cx } from './ui';
import { Icon, Icons, type LucideIcon } from './icons';

const TONES: Record<Toast['tone'], string> = {
  info: 'bg-surface-raised text-ink',
  success: 'bg-surface-raised text-ink',
  warning: 'bg-surface-raised text-ink',
  danger: 'bg-surface-raised text-ink',
};

const ICONS: Record<Toast['tone'], LucideIcon> = {
  info: Icons.info,
  success: Icons.check,
  warning: Icons.warning,
  danger: Icons.close,
};

const ICON_TONES: Record<Toast['tone'], string> = {
  info: 'text-ink-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((state) => state.dismissToast);

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div
      className={cx(
        'pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2.5 animate-rise',
        TONES[toast.tone],
      )}
      style={{ boxShadow: 'var(--shadow-border)' }}
    >
      <span className={ICON_TONES[toast.tone]}>
        <Icon icon={ICONS[toast.tone]} size={16} />
      </span>
      <p className="flex-1 text-sm">{toast.message}</p>
      {toast.action && (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            toast.action?.onAction();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      )}
    </div>
  );
}

/** Live region for transient feedback, including the undo affordance for deletions. */
export function Toaster() {
  const toasts = useAppStore((state) => state.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-3 sm:bottom-4 lg:left-auto lg:right-4 lg:mx-0"
    >
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
