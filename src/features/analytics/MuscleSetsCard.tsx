import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, NumberInput, Select, cx } from '@/components/ui';
import { MUSCLE_GROUPS, titleCase } from '@/domain/taxonomy';
import type { MuscleGroup, PersonalMuscleTargets } from '@/domain/types';
import { formatWeight, type WeightUnit } from '@/domain/units';
import {
  RESEARCH_MUSCLE_TARGET,
  researchTargetFor,
  type MuscleSetInsight,
  type MuscleTargetState,
} from './muscleSets';
import { researchMuscleTargetClaim } from '@/domain/evidence';
import { ClaimEvidenceSheet } from './ClaimEvidenceSheet';

export function MuscleSetsCard({
  insights,
  secondaryCredit,
  weightUnit,
  personalTargets = {},
  onPersonalTargetsChange,
}: {
  insights: readonly MuscleSetInsight[];
  secondaryCredit: number;
  weightUnit: WeightUnit;
  personalTargets?: PersonalMuscleTargets;
  onPersonalTargetsChange?: (targets: PersonalMuscleTargets) => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [showResearchEvidence, setShowResearchEvidence] = useState(false);
  const researchClaim = researchMuscleTargetClaim();
  const [showTargetEditor, setShowTargetEditor] = useState(false);
  const initialMuscle =
    insights.find((row) => researchTargetFor(row.muscle))?.muscle ?? TARGETABLE_MUSCLES[0];
  const [editingMuscle, setEditingMuscle] = useState<MuscleGroup>(initialMuscle ?? 'chest');
  const initialTarget = personalTargets[editingMuscle] ?? RESEARCH_MUSCLE_TARGET;
  const [draftMin, setDraftMin] = useState(String(initialTarget.min));
  const [draftMax, setDraftMax] = useState(String(initialTarget.max));
  const hasNonMuscleTotals = insights.some((row) => row.state === 'not_set');
  const parsedMin = Number.parseFloat(draftMin);
  const parsedMax = Number.parseFloat(draftMax);
  const draftValid =
    Number.isFinite(parsedMin) &&
    Number.isFinite(parsedMax) &&
    parsedMin >= 0 &&
    parsedMax <= 100 &&
    parsedMin <= parsedMax;

  return (
    <Card className="mb-4 border-accent/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Am I training enough?
      </p>
      <h2 className="mt-1 text-lg font-bold text-ink">Your hard sets this week</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Completed working sets only. Warm-ups, drop sets, failure sets and unfinished sets do not
        count.
      </p>

      {insights.length === 0 ? (
        <p className="mt-4 rounded border border-line bg-surface-raised p-3 text-sm text-ink-muted">
          No completed working sets in this training week yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded border border-line bg-surface-raised px-3">
          {insights.map((row) => (
            <li key={row.muscle} className="flex min-h-14 items-center justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-semibold text-ink">{titleCase(row.muscle)}</p>
                {row.muscle === 'unmapped' && (
                  <Link to="/exercises" className="text-xs font-medium text-accent">
                    Fix in Library
                  </Link>
                )}
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-bold tabular-nums text-ink">
                  {row.target
                    ? `${formatSets(row.sets)} of ${formatSets(row.target.min)}–${formatSets(row.target.max)} credited sets`
                    : `${formatSets(row.sets)} credited sets`}
                </p>
                <p className={cx('text-xs font-semibold', stateTone(row.state))}>
                  {stateLabel(row)}
                </p>
                {row.targetSource && (
                  <p className="text-[11px] text-ink-subtle">
                    {targetSourceLabel(row.targetSource)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasNonMuscleTotals && (
        <p className="mt-3 text-xs leading-relaxed text-ink-muted">
          Full-body and cardio work stays visible as a total, but does not use a muscle target
          range.
        </p>
      )}

      {insights.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showEvidence}
            onClick={() => setShowEvidence((visible) => !visible)}
          >
            {showEvidence ? 'Hide evidence' : 'Show me why'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showResearchEvidence}
            onClick={() => setShowResearchEvidence(true)}
          >
            Why this range
          </Button>
          {onPersonalTargetsChange && (
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={showTargetEditor}
              onClick={() => setShowTargetEditor((visible) => !visible)}
            >
              {showTargetEditor ? 'Close target editor' : 'Edit personal targets'}
            </Button>
          )}
        </div>
      )}

      {showTargetEditor && onPersonalTargetsChange && (
        <div className="mt-3 border-t border-line pt-3">
          <h3 className="text-sm font-semibold text-ink">Personal target</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Each muscle starts at the 10–20 research default. Save an override when your program
            calls for a different range.
          </p>
          <label className="mt-3 block text-xs font-semibold text-ink-muted">
            Muscle
            <Select
              className="mt-1"
              value={editingMuscle}
              onChange={(event) => {
                const muscle = event.target.value as MuscleGroup;
                const target = personalTargets[muscle] ?? RESEARCH_MUSCLE_TARGET;
                setEditingMuscle(muscle);
                setDraftMin(String(target.min));
                setDraftMax(String(target.max));
              }}
            >
              {TARGETABLE_MUSCLES.map((muscle) => (
                <option key={muscle} value={muscle}>
                  {titleCase(muscle)}
                </option>
              ))}
            </Select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-ink-muted">
              Minimum sets
              <NumberInput
                aria-label="Minimum sets"
                className="mt-1"
                min={0}
                max={100}
                step={0.5}
                value={draftMin}
                onChange={(event) => setDraftMin(event.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Maximum sets
              <NumberInput
                aria-label="Maximum sets"
                className="mt-1"
                min={0}
                max={100}
                step={0.5}
                value={draftMax}
                onChange={(event) => setDraftMax(event.target.value)}
              />
            </label>
          </div>
          {!draftValid && (
            <p className="mt-2 text-xs font-semibold text-warning">
              Enter a range from 0 to 100 with the minimum no higher than the maximum.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!draftValid}
              onClick={() =>
                onPersonalTargetsChange({
                  ...personalTargets,
                  [editingMuscle]: { min: parsedMin, max: parsedMax },
                })
              }
            >
              Save personal target
            </Button>
            {personalTargets[editingMuscle] && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const next = { ...personalTargets };
                  delete next[editingMuscle];
                  setDraftMin(String(RESEARCH_MUSCLE_TARGET.min));
                  setDraftMax(String(RESEARCH_MUSCLE_TARGET.max));
                  onPersonalTargetsChange(next);
                }}
              >
                Use research default
              </Button>
            )}
          </div>
        </div>
      )}

      {showEvidence && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            A completed working set gives its primary muscle 1 set. Each secondary muscle gets{' '}
            {formatSets(secondaryCredit)} set. The same physical set is listed under every muscle it
            credits.
          </p>
          <div className="mt-3 space-y-3">
            {insights.map((row) => (
              <section key={row.muscle} aria-labelledby={`evidence-${row.muscle}`}>
                <h3 id={`evidence-${row.muscle}`} className="text-sm font-semibold text-ink">
                  {titleCase(row.muscle)} · {formatSets(row.sets)} sets
                </h3>
                <ul className="mt-1 space-y-1">
                  {row.evidence.map((item) => (
                    <li
                      key={`${row.muscle}-${item.setId}-${item.role}`}
                      className="rounded border border-line bg-surface px-3 py-2 text-xs"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-semibold text-ink">{item.exerciseName}</span>
                        <span className="shrink-0 text-ink-subtle">{item.localDate}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap justify-between gap-x-3 text-ink-muted">
                        <span>
                          {titleCase(item.role)} · {formatSets(item.credit)} set
                        </span>
                        {(item.weightG !== undefined || item.reps !== undefined) && (
                          <span>
                            {item.weightG !== undefined
                              ? `${formatWeight(item.weightG, weightUnit)} ${weightUnit}`
                              : 'Bodyweight'}
                            {item.reps !== undefined ? ` × ${item.reps}` : ''}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      <ClaimEvidenceSheet
        open={showResearchEvidence}
        onClose={() => setShowResearchEvidence(false)}
        claim={researchClaim}
        title="Why 10–20 credited sets"
      />
    </Card>
  );
}

const TARGETABLE_MUSCLES = MUSCLE_GROUPS.filter((muscle) => researchTargetFor(muscle));

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function stateLabel(row: MuscleSetInsight): string {
  if (row.state === 'in_range') return 'In range';
  if (row.state === 'below') return 'Below';
  if (row.state === 'above') return 'Above';
  if (row.state === 'unmapped') return 'Unmapped';
  return 'Target not set';
}

function stateTone(state: MuscleTargetState): string {
  if (state === 'in_range') return 'text-success';
  if (state === 'unmapped') return 'text-warning';
  if (state === 'not_set') return 'text-ink-subtle';
  return 'text-warning';
}

function targetSourceLabel(source: NonNullable<MuscleSetInsight['targetSource']>): string {
  return source === 'personal' ? 'Personal target' : 'Research default';
}
