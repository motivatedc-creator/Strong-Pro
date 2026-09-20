import { Button, Sheet, cx } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import type { GoalLens } from '@/domain/types';

const LENS_OPTIONS: Array<{ value: GoalLens; label: string; description: string }> = [
  {
    value: 'build',
    label: 'Build',
    description: "Today's default framing — a down week reads as something to watch.",
  },
  {
    value: 'strength',
    label: 'Strength',
    description:
      'Names whether your goal lift held or slipped, and treats a lighter week as an intensity block when it held.',
  },
  {
    value: 'maintain',
    label: 'Maintain',
    description: 'Drops the "down" framing — a quieter week reads as holding within your usual range.',
  },
];

/**
 * Lets the user pick which framing the Weekly Verdict uses. Structurally simpler than
 * {@link GoalLiftPicker} — no baseline computation, just three fixed rows. Reused from both the
 * verdict card and Settings, mirroring the goal-lifts precedent exactly.
 */
export function GoalLensPicker({
  open,
  onClose,
  goalLens,
  onGoalLensChange,
}: {
  open: boolean;
  onClose: () => void;
  goalLens: GoalLens | undefined;
  onGoalLensChange: (lens: GoalLens) => void;
}) {
  const current = goalLens ?? 'build';

  const choose = (lens: GoalLens) => {
    onGoalLensChange(lens);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Goal lens"
      description="Changes how the Weekly Verdict describes the same numbers. It never changes the numbers themselves."
      size="md"
      footer={
        <Button block onClick={onClose}>
          Close
        </Button>
      }
    >
      <ul className="space-y-1.5">
        {LENS_OPTIONS.map((option) => {
          const isSelected = option.value === current;
          return (
            <li key={option.value}>
              <button
                type="button"
                data-autofocus={isSelected ? true : undefined}
                aria-pressed={isSelected}
                onClick={() => choose(option.value)}
                className={cx(
                  'flex min-h-tap w-full items-start gap-3 rounded border px-3 py-2 text-left transition',
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-surface-raised hover:border-accent/60',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                    isSelected
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line text-ink-subtle',
                  )}
                >
                  {isSelected && <Icon icon={Icons.check} size={12} strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {option.label}
                    {isSelected ? ' (current)' : ''}
                  </span>
                  <span className="block text-xs text-ink-subtle">{option.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
