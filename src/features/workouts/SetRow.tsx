import { useEffect, useState } from 'react';
import { Button, IconButton, NumberInput, cx } from '@/components/ui';
import { SET_TYPES, usesDistance, usesDuration, usesReps, usesWeight } from '@/domain/taxonomy';
import type { IntensityMode, SetType, TrackingType, WorkoutSet } from '@/domain/types';
import { formatWeight, fromGrams, toGrams, trimNumber, type WeightUnit } from '@/domain/units';

/**
 * One logged set.
 *
 * Values are held locally while the field has focus and written on blur/step so that every
 * keystroke does not hit IndexedDB, but completion (the one-tap action that matters mid-set)
 * writes immediately. Weight is displayed in the user's unit and stored in grams.
 */
export function SetRow({
  set,
  index,
  trackingType,
  weightUnit,
  intensityMode,
  quickIncrementG,
  previous,
  isPr,
  onChange,
  onToggleComplete,
  onDelete,
  onCopyPrevious,
  onCycleType,
}: {
  set: WorkoutSet;
  index: number;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  intensityMode: IntensityMode;
  quickIncrementG: number;
  previous?: WorkoutSet;
  isPr?: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onCopyPrevious?: () => void;
  onCycleType: (setType: SetType) => void;
}) {
  const [weightText, setWeightText] = useState(() =>
    set.weightG === undefined ? '' : formatWeight(set.weightG, weightUnit),
  );
  const [repsText, setRepsText] = useState(set.reps === undefined ? '' : String(set.reps));

  // Keep local text in sync when the row changes underneath (undo, unit switch, copy).
  useEffect(() => {
    setWeightText(set.weightG === undefined ? '' : formatWeight(set.weightG, weightUnit));
  }, [set.weightG, weightUnit]);
  useEffect(() => {
    setRepsText(set.reps === undefined ? '' : String(set.reps));
  }, [set.reps]);

  const typeMeta = SET_TYPES.find((entry) => entry.value === set.setType)!;
  const nextType =
    SET_TYPES[
      (SET_TYPES.findIndex((entry) => entry.value === set.setType) + 1) % SET_TYPES.length
    ]!;

  const commitWeight = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === '') {
      onChange({ weightG: undefined });
      return;
    }
    const value = Number.parseFloat(trimmed.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      setWeightText(set.weightG === undefined ? '' : formatWeight(set.weightG, weightUnit));
      return;
    }
    onChange({ weightG: toGrams(value, weightUnit) });
  };

  const step = (direction: 1 | -1) => {
    const current = set.weightG ?? 0;
    const next = Math.max(0, current + direction * quickIncrementG);
    onChange({ weightG: next });
    setWeightText(formatWeight(next, weightUnit));
  };

  const previousLabel = previous
    ? [
        previous.weightG !== undefined
          ? `${formatWeight(previous.weightG, weightUnit)} ${weightUnit}`
          : null,
        previous.reps !== undefined ? `× ${previous.reps}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    : '—';

  return (
    <li
      className={cx(
        'grid grid-cols-[2.25rem_1fr_auto] items-center gap-2 rounded border px-2 py-2 transition sm:grid-cols-[2.5rem_5.5rem_1fr_auto]',
        set.isCompleted ? 'border-success/50 bg-success/10' : 'border-line bg-surface-raised',
      )}
    >
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => onCycleType(nextType.value)}
          title={`Set type: ${typeMeta.label}. Tap to change to ${nextType.label}.`}
          aria-label={`Set ${index + 1}, ${typeMeta.label}. Change set type`}
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded text-sm font-bold',
            set.setType === 'warmup'
              ? 'bg-warning/20 text-warning'
              : set.setType === 'drop'
                ? 'bg-accent/20 text-accent'
                : set.setType === 'failure'
                  ? 'bg-danger/20 text-danger'
                  : 'text-ink-muted',
          )}
        >
          {typeMeta.short || index + 1}
        </button>
      </div>

      <div className="hidden text-xs text-ink-subtle sm:block">
        <span className="block text-[10px] uppercase tracking-wide">Previous</span>
        <span className="tabular-nums">{previousLabel}</span>
        {onCopyPrevious && previous && (
          <button
            type="button"
            onClick={onCopyPrevious}
            className="mt-0.5 block text-[11px] font-semibold text-accent"
          >
            Copy
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {usesWeight(trackingType) && (
          <div className="flex items-center gap-1">
            <IconButton
              label="Decrease weight"
              variant="secondary"
              onClick={() => step(-1)}
              className="h-9 w-9"
            >
              <span aria-hidden="true">−</span>
            </IconButton>
            <NumberInput
              value={weightText}
              aria-label={`Weight for set ${index + 1} in ${weightUnit}`}
              step="any"
              min={0}
              className="h-10 w-20 min-h-0 px-2"
              onChange={(event) => setWeightText(event.target.value)}
              onBlur={(event) => commitWeight(event.target.value)}
            />
            <IconButton
              label="Increase weight"
              variant="secondary"
              onClick={() => step(1)}
              className="h-9 w-9"
            >
              <span aria-hidden="true">+</span>
            </IconButton>
          </div>
        )}

        {usesReps(trackingType) && (
          <NumberInput
            value={repsText}
            aria-label={`Reps for set ${index + 1}`}
            inputMode="numeric"
            min={0}
            className="h-10 w-16 min-h-0 px-2"
            placeholder="reps"
            onChange={(event) => setRepsText(event.target.value)}
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({ reps: Number.isFinite(value) && value >= 0 ? value : undefined });
            }}
          />
        )}

        {usesDuration(trackingType) && (
          <NumberInput
            defaultValue={set.durationSeconds ?? ''}
            aria-label={`Duration in seconds for set ${index + 1}`}
            inputMode="numeric"
            min={0}
            className="h-10 w-20 min-h-0 px-2"
            placeholder="secs"
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({
                durationSeconds: Number.isFinite(value) && value >= 0 ? value : undefined,
              });
            }}
          />
        )}

        {usesDistance(trackingType) && (
          <NumberInput
            defaultValue={set.distanceM ?? ''}
            aria-label={`Distance in metres for set ${index + 1}`}
            inputMode="numeric"
            min={0}
            className="h-10 w-20 min-h-0 px-2"
            placeholder="m"
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({ distanceM: Number.isFinite(value) && value >= 0 ? value : undefined });
            }}
          />
        )}

        {intensityMode !== 'none' && (
          <NumberInput
            defaultValue={intensityMode === 'rpe' ? (set.rpe ?? '') : (set.rir ?? '')}
            aria-label={`${intensityMode.toUpperCase()} for set ${index + 1}`}
            step="0.5"
            min={0}
            max={intensityMode === 'rpe' ? 10 : 10}
            className="h-10 w-16 min-h-0 px-2"
            placeholder={intensityMode.toUpperCase()}
            onBlur={(event) => {
              const raw = event.target.value.trim();
              const value = raw === '' ? undefined : Number.parseFloat(raw.replace(',', '.'));
              const valid =
                value !== undefined && Number.isFinite(value) && value >= 0 && value <= 10;
              onChange(
                intensityMode === 'rpe'
                  ? { rpe: valid ? value : undefined }
                  : { rir: valid ? value : undefined },
              );
            }}
          />
        )}
      </div>

      <div className="flex items-center gap-1">
        {isPr && (
          <span
            title="Personal record"
            className="hidden rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent sm:inline"
          >
            PR
          </span>
        )}
        <Button
          size="sm"
          variant={set.isCompleted ? 'success' : 'secondary'}
          aria-pressed={set.isCompleted}
          aria-label={
            set.isCompleted ? `Mark set ${index + 1} as not done` : `Complete set ${index + 1}`
          }
          className="h-10 w-11 px-0"
          onClick={onToggleComplete}
        >
          <span aria-hidden="true" className="text-base">
            ✓
          </span>
        </Button>
        <IconButton label={`Delete set ${index + 1}`} onClick={onDelete} className="h-10 w-9">
          <span aria-hidden="true">🗑</span>
        </IconButton>
      </div>

      {/* Mobile: previous-set reference sits under the inputs where there is room. */}
      <p className="col-span-3 -mt-1 flex items-center gap-2 text-[11px] text-ink-subtle sm:hidden">
        <span>Prev: {previousLabel}</span>
        {onCopyPrevious && previous && (
          <button type="button" onClick={onCopyPrevious} className="font-semibold text-accent">
            Copy
          </button>
        )}
        {set.weightG !== undefined && set.reps ? (
          <span className="ml-auto tabular-nums">
            {trimNumber(Math.round(fromGrams(set.weightG, weightUnit) * set.reps))} {weightUnit}{' '}
            volume
          </span>
        ) : null}
      </p>
    </li>
  );
}
