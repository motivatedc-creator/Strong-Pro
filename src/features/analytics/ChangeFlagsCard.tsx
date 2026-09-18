import { useState } from 'react';
import { Card, Sheet, cx } from '@/components/ui';
import { getClaim } from '@/domain/evidence';
import { formatCompactNumber, fromGrams, type WeightUnit } from '@/domain/units';
import { ClaimEvidenceSheet } from './ClaimEvidenceSheet';
import {
  CHANGE_FLAGS_EMPTY,
  type DeloadFlag,
  type SpikeFlag,
  type StallFlag,
  type TrainingFlags,
} from './trainingFlags';

type FlagRow = DeloadFlag | SpikeFlag | StallFlag;

function formatE1rm(grams: number | null, weightUnit: WeightUnit): string {
  if (grams === null) return '—';
  return `${formatCompactNumber(fromGrams(grams, weightUnit))} ${weightUnit}`;
}

export function ChangeFlagsCard({
  flags,
  weightUnit,
}: {
  flags: TrainingFlags;
  weightUnit: WeightUnit;
}) {
  const [selected, setSelected] = useState<FlagRow | null>(null);
  const [showClaim, setShowClaim] = useState(false);
  const active = flags.active;
  const deloadClaim = getClaim(flags.deload.claimId);

  return (
    <Card className="mb-4 border-accent/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        What should I change?
      </p>
      <h2 className="mt-1 text-lg font-bold text-ink">Stall, spike, and deload flags</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Named flags recomputed from logged work. Not a program — open a flag for the receipt.
      </p>

      {active.length === 0 ? (
        <p className="mt-4 rounded border border-line bg-surface-raised p-3 text-sm text-ink-muted">
          {CHANGE_FLAGS_EMPTY}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded border border-line bg-surface-raised px-3">
          {active.map((flag) => (
            <li key={flag.id === 'stall' ? `stall-${flag.liftId}` : flag.id}>
              <button
                type="button"
                className={cx(
                  'flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left',
                  'transition-colors hover:bg-surface/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                )}
                onClick={() => setSelected(flag)}
              >
                <span className="text-sm font-semibold text-ink">{flag.label}</span>
                <span className="text-xs font-semibold text-accent">Open receipt</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setShowClaim(false);
        }}
        title={selected?.label ?? 'Flag receipt'}
        description="Numbers from logged sessions. No coaching prescription."
        size="lg"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <Card className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Receipt
              </p>
              <p className="mt-1 font-medium text-ink">{selected.receipt}</p>
            </Card>

            {selected.id === 'deload' && (
              <ul className="space-y-1 rounded border border-line bg-surface-raised px-3 py-2 font-mono text-xs tabular-nums text-ink-muted">
                <li>
                  Subject week {selected.subjectStartDate} → {selected.subjectEndDate}
                </li>
                <li>
                  Hard sets {selected.subjectHardSets} vs baseline mean{' '}
                  {selected.baselineHardSetsMean.toFixed(1)}
                </li>
                <li>
                  Sessions {selected.subjectSessions} vs floor {selected.sessionFloor}
                </li>
              </ul>
            )}

            {selected.id === 'spike' && (
              <ul className="space-y-1 rounded border border-line bg-surface-raised px-3 py-2 font-mono text-xs tabular-nums text-ink-muted">
                <li>
                  Subject week {selected.subjectStartDate} → {selected.subjectEndDate}
                </li>
                <li>
                  Direction{' '}
                  {selected.directionBand?.replaceAll('_', ' ') ?? 'none'}
                  {selected.changePercent != null
                    ? ` (${selected.changePercent >= 0 ? '+' : ''}${Math.round(selected.changePercent)}%)`
                    : ''}
                </li>
              </ul>
            )}

            {selected.id === 'stall' && (
              <ul className="space-y-1 rounded border border-line bg-surface-raised px-3 py-2 font-mono text-xs tabular-nums text-ink-muted">
                <li>
                  Window {selected.windowStartDate} → {selected.windowEndDate}
                </li>
                <li>Sessions in window {selected.sessionsInWindow}</li>
                <li>
                  Best e1RM in window {formatE1rm(selected.bestE1rmInWindowG, weightUnit)}
                </li>
                <li>
                  Comparison e1RM {formatE1rm(selected.comparisonBestE1rmG, weightUnit)}
                  {selected.comparisonSource
                    ? ` (${selected.comparisonSource.replaceAll('_', ' ')})`
                    : ''}
                </li>
              </ul>
            )}

            {selected.id === 'deload' && deloadClaim && (
              <button
                type="button"
                className="w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-left"
                onClick={() => setShowClaim(true)}
              >
                <span className="block text-sm font-semibold text-ink">
                  {deloadClaim.statement}
                </span>
                <span className="mt-1 block text-[11px] text-accent">Open claim receipt</span>
              </button>
            )}
          </div>
        )}
      </Sheet>

      {deloadClaim && (
        <ClaimEvidenceSheet
          open={showClaim}
          onClose={() => setShowClaim(false)}
          claim={deloadClaim}
          title="Deload claim"
        />
      )}
    </Card>
  );
}
