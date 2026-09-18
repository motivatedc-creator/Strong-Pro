import { useEffect, useId, useRef, useState } from 'react';
import { Button, IconButton, NumberInput, cx } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { SET_TYPES, usesDistance, usesDuration, usesReps, usesWeight } from '@/domain/taxonomy';
import type { IntensityMode, SetType, TrackingType, WorkoutSet } from '@/domain/types';
import { formatWeight, fromGrams, toGrams, trimNumber, type WeightUnit } from '@/domain/units';
import { previousSetPatch } from './setPrefill';

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
  onToggleComplete: (prefill: Partial<WorkoutSet>) => void;
  onDelete: () => void;
  onCycleType: (setType: SetType) => void;
}) {
  const previousDescriptionId = useId();
  const repsInputRef = useRef<HTMLInputElement>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);
  const distanceInputRef = useRef<HTMLInputElement>(null);
  const completionButtonRef = useRef<HTMLButtonElement>(null);
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
  const completionPatch = () => {
    // A click moves focus before its handler runs. Read the visible draft directly so a
    // just-typed value cannot be overwritten by the previous-set fallback while the blur
    // persistence is still in flight.
    const draft = { ...set };
    const displayWeight = Number.parseFloat(weightText.trim().replace(',', '.'));
    const reps = Number.parseInt(repsText.trim(), 10);
    const duration = Number.parseInt(durationInputRef.current?.value.trim() ?? '', 10);
    const distance = Number.parseInt(distanceInputRef.current?.value.trim() ?? '', 10);
    const patch: Partial<WorkoutSet> = {};

    if (usesWeight(trackingType) && Number.isFinite(displayWeight) && displayWeight >= 0) {
      draft.weightG = toGrams(displayWeight, weightUnit);
      patch.weightG = draft.weightG;
    }
    if (usesReps(trackingType) && Number.isFinite(reps) && reps >= 0) {
      draft.reps = reps;
      patch.reps = reps;
    }
    if (usesDuration(trackingType) && Number.isFinite(duration) && duration >= 0) {
      draft.durationSeconds = duration;
      patch.durationSeconds = duration;
    }
    if (usesDistance(trackingType) && Number.isFinite(distance) && distance >= 0) {
      draft.distanceM = distance;
      patch.distanceM = distance;
    }

    return { ...previousSetPatch(draft, previous, trackingType), ...patch };
  };
  const previousWeightPlaceholder =
    previous?.weightG === undefined ? undefined : formatWeight(previous.weightG, weightUnit);
  const previousRepsPlaceholder = previous?.reps === undefined ? undefined : String(previous.reps);

  return (
    <li
      className={cx(
        // Two columns on a narrow phone (badge + inputs, with the actions and the
        // previous-set line wrapping underneath); four columns once there is room.
        'grid grid-cols-[2.75rem_1fr] items-center gap-2 rounded-xl px-2 py-2 transition-[background-color,box-shadow] duration-150 sm:grid-cols-[2.75rem_5.5rem_1fr_auto]',
        set.isCompleted
          ? 'bg-success/12 shadow-[inset_3px_0_0_0_rgb(var(--rf-success))]'
          : 'bg-surface-raised shadow-[inset_0_0_0_1px_rgb(var(--rf-line)/0.7)]',
      )}
    >
      {previous && (
        <span id={previousDescriptionId} className="rf-sr-only">
          Previous set: {previousLabel}. Empty fields will use these values when completed.
        </span>
      )}
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => onCycleType(nextType.value)}
          title={`Set type: ${typeMeta.label}. Tap to change to ${nextType.label}.`}
          aria-label={`Set ${index + 1}, ${typeMeta.label}. Change set type`}
          className={cx(
            'flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold',
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
        <span className="block text-[10px] uppercase tracking-wide">Last time</span>
        <span className="tabular-nums">{previousLabel}</span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {usesWeight(trackingType) && (
          <div className="flex items-center gap-1">
            <IconButton
              label="Decrease weight"
              variant="secondary"
              onClick={() => step(-1)}
              className="h-11 w-11 rounded-lg"
            >
              <Icon icon={Icons.minus} size={16} />
            </IconButton>
            <NumberInput
              value={weightText}
              aria-label={`Weight for set ${index + 1} in ${weightUnit}`}
              aria-describedby={previous ? previousDescriptionId : undefined}
              step="any"
              min={0}
              placeholder={previousWeightPlaceholder}
              className="h-11 w-[4.5rem] min-h-0 rounded-lg px-2 sm:w-20"
              onChange={(event) => setWeightText(event.target.value)}
              onBlur={(event) => commitWeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                (
                  repsInputRef.current ??
                  durationInputRef.current ??
                  distanceInputRef.current ??
                  completionButtonRef.current
                )?.focus();
              }}
            />
            <IconButton
              label="Increase weight"
              variant="secondary"
              onClick={() => step(1)}
              className="h-11 w-11 rounded-lg"
            >
              <Icon icon={Icons.plus} size={16} />
            </IconButton>
          </div>
        )}

        {usesReps(trackingType) && (
          <NumberInput
            ref={repsInputRef}
            value={repsText}
            aria-label={`Reps for set ${index + 1}`}
            aria-describedby={previous ? previousDescriptionId : undefined}
            inputMode="numeric"
            min={0}
            className="h-11 w-14 min-h-0 rounded-lg px-2 sm:w-16"
            placeholder={previousRepsPlaceholder ?? 'reps'}
            onChange={(event) => setRepsText(event.target.value)}
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({ reps: Number.isFinite(value) && value >= 0 ? value : undefined });
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              (
                durationInputRef.current ??
                distanceInputRef.current ??
                completionButtonRef.current
              )?.focus();
            }}
          />
        )}

        {usesDuration(trackingType) && (
          <NumberInput
            ref={durationInputRef}
            defaultValue={set.durationSeconds ?? ''}
            aria-label={`Duration in seconds for set ${index + 1}`}
            aria-describedby={previous ? previousDescriptionId : undefined}
            inputMode="numeric"
            min={0}
            className="h-11 w-16 min-h-0 rounded-lg px-2 sm:w-20"
            placeholder={
              previous?.durationSeconds === undefined ? 'secs' : String(previous.durationSeconds)
            }
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({
                durationSeconds: Number.isFinite(value) && value >= 0 ? value : undefined,
              });
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              (distanceInputRef.current ?? completionButtonRef.current)?.focus();
            }}
          />
        )}

        {usesDistance(trackingType) && (
          <NumberInput
            ref={distanceInputRef}
            defaultValue={set.distanceM ?? ''}
            aria-label={`Distance in metres for set ${index + 1}`}
            aria-describedby={previous ? previousDescriptionId : undefined}
            inputMode="numeric"
            min={0}
            className="h-11 w-16 min-h-0 rounded-lg px-2 sm:w-20"
            placeholder={previous?.distanceM === undefined ? 'm' : String(previous.distanceM)}
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onChange({ distanceM: Number.isFinite(value) && value >= 0 ? value : undefined });
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              completionButtonRef.current?.focus();
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
            className="h-11 w-14 min-h-0 rounded-lg px-2 sm:w-16"
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

      <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
        {isPr && (
          <span
            title="Personal record"
            className="hidden rounded-md bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent sm:inline"
          >
            PR
          </span>
        )}
        <Button
          ref={completionButtonRef}
          size="sm"
          variant={set.isCompleted ? 'success' : 'secondary'}
          aria-pressed={set.isCompleted}
          aria-label={
            set.isCompleted ? `Mark set ${index + 1} as not done` : `Complete set ${index + 1}`
          }
          className="h-11 w-12 rounded-xl px-0"
          onClick={() => onToggleComplete(set.isCompleted ? {} : completionPatch())}
        >
          <Icon icon={Icons.check} size={18} strokeWidth={2.4} />
        </Button>
        <IconButton label={`Delete set ${index + 1}`} onClick={onDelete} className="h-11 w-11">
          <Icon icon={Icons.trash} size={16} />
        </IconButton>
      </div>

      {/* Mobile: previous-set reference sits under the inputs where there is room. */}
      <p className="col-span-2 -mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle sm:hidden">
        <span>Last: {previousLabel}</span>
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
