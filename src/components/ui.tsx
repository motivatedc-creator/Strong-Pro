import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon, Icons } from './icons';

/**
 * Certified UI primitives.
 *
 * Rules baked in here rather than left to each screen:
 *  - every interactive control is at least 44x44 px,
 *  - focus is always visible (see :focus-visible in styles/index.css),
 *  - status is never signalled by colour alone — icons, text or borders accompany it,
 *  - numeric inputs open a numeric keypad on mobile.
 */

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface-raised text-ink shadow-[inset_0_0_0_1px_rgb(var(--rf-line))] hover:bg-surface',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-raised',
  danger: 'bg-danger text-danger-ink hover:brightness-110',
  success: 'bg-success text-canvas hover:brightness-110',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-[2.25rem] px-3 text-sm rounded-lg',
  md: 'min-h-tap px-4 text-sm rounded-xl',
  lg: 'min-h-[3.25rem] px-5 text-base rounded-xl',
};

/**
 * Classes shared by <Button> and link-shaped buttons, so a <Link> that acts as a button
 * looks identical without nesting an anchor inside a <button>.
 */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  block = false,
): string {
  return cx(
    'inline-flex items-center justify-center gap-2 font-semibold',
    'transition-[transform,filter,background-color,color,opacity] duration-150 ease-out',
    'active:scale-[0.96]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    block,
    icon,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(buttonClasses(variant, size, block), className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: ButtonVariant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-tap w-tap shrink-0 items-center justify-center rounded-xl',
        'transition-[transform,background-color,color,opacity] duration-150 ease-out',
        'active:scale-[0.96] disabled:active:scale-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Card({
  children,
  className,
  as: Component = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
}) {
  return <Component className={cx('rf-card p-4', className)}>{children}</Component>;
}

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy?: string }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mb-4">
      <label className="rf-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 flex items-center gap-1 text-xs font-medium text-danger"
        >
          <Icon icon={Icons.warning} size={14} />
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cx('rf-input', className)} {...rest} />;
  },
);

/** Numeric input that opens a decimal keypad and never shows spinner arrows. */
export const NumberInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function NumberInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        className={cx('rf-input text-right tabular-nums', className)}
        {...rest}
      />
    );
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx('rf-input min-h-[5rem] py-2', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cx('rf-input pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-2xl bg-surface-raised p-1 shadow-[inset_0_0_0_1px_rgb(var(--rf-line))]"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex-1 rounded-xl px-2 font-semibold transition-[background-color,color,transform] duration-150 ease-out',
              'active:scale-[0.98]',
              size === 'sm' ? 'min-h-[2.25rem] text-xs' : 'min-h-tap text-sm',
              selected
                ? 'bg-accent text-accent-ink shadow-sm'
                : 'text-ink-muted hover:bg-surface hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-tap items-center justify-between gap-4 py-2">
      <span className="flex-1">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <span className="mt-0.5 block text-xs text-ink-subtle">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-[background-color] duration-150 ease-out disabled:opacity-50',
          checked ? 'bg-accent' : 'bg-surface-raised shadow-[inset_0_0_0_1px_rgb(var(--rf-line))]',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full transition-[left,background-color] duration-150 ease-out',
            checked ? 'left-6 bg-accent-ink text-accent' : 'left-0.5 bg-ink-subtle text-surface',
          )}
          aria-hidden="true"
        >
          {checked ? <Icon icon={Icons.check} size={12} strokeWidth={2.5} /> : null}
        </span>
      </button>
    </div>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: 'border-line bg-surface-raised text-ink-muted',
    accent: 'border-accent/40 bg-accent/15 text-accent',
    success: 'border-success/40 bg-success/15 text-success',
    warning: 'border-warning/40 bg-warning/15 text-warning',
    danger: 'border-danger/40 bg-danger/15 text-danger',
  };
  return (
    <span className={cx('rf-chip', tones[tone])}>
      {icon}
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rf-card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised text-ink-subtle">
        {icon ?? <Icon icon={Icons.dumbbell} size={22} />}
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted"
      role="status"
    >
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function ErrorNotice({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rf-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-danger">
        <Icon icon={Icons.warning} size={16} />
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on wider screens. Traps focus and closes on Escape. */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel
      ?.querySelector<HTMLElement>('[data-autofocus], button, input, select, textarea, a[href]')
      ?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-black/65"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-surface shadow-sheet',
          'animate-rise sm:rounded-3xl',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <Icon icon={Icons.close} size={18} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-2">{children}</div>
        {footer && (
          <footer className="bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Destructive-action dialog. The body must explain the effect, not just ask "are you sure". */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex gap-2">
          <Button block onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button block variant={tone} onClick={onConfirm} data-autofocus>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-sm text-ink-muted">{body}</div>
    </Sheet>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[1.75rem] leading-none tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'neutral' | 'accent' | 'success';
}) {
  return (
    <div
      className="rounded-2xl bg-surface px-3 py-3.5"
      style={{ boxShadow: 'var(--shadow-border)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </p>
      <p
        className={cx(
          'mt-1.5 text-data-lg tabular-nums',
          tone === 'accent' ? 'text-accent' : tone === 'success' ? 'text-success' : 'text-ink',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="rf-section-label">{children}</h2>
      {action}
    </div>
  );
}
