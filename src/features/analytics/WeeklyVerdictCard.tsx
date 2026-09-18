import { useState } from 'react';
import { Card, Chip } from '@/components/ui';
import type { WeightUnit } from '@/domain/units';
import { VerdictEvidenceSheet, formatDateRange } from './VerdictEvidenceSheet';
import type { MuscleBandBalance } from './muscleSets';
import {
  weeklyVerdictCopy,
  type SentencePart,
  type VerdictEvidenceKey,
  type WeeklyVerdict,
} from './weeklyVerdict';

export function WeeklyVerdictCard({
  verdict,
  weightUnit,
  muscleBalance = null,
}: {
  verdict: WeeklyVerdict;
  weightUnit: WeightUnit;
  /** Subject-week muscle-band balance from shared muscleBandBalance helper. */
  muscleBalance?: MuscleBandBalance | null;
}) {
  const [evidenceKey, setEvidenceKey] = useState<VerdictEvidenceKey | null>(null);
  const copy = weeklyVerdictCopy(verdict, weightUnit, muscleBalance);

  return (
    <section aria-labelledby="weekly-verdict-heading">
      <Card className="mb-4 border-accent/30">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Weekly Verdict
            </p>
            <h2 id="weekly-verdict-heading" className="text-base font-semibold text-ink">
              {copy.title}
            </h2>
            <p className="text-xs text-ink-subtle">
              {formatDateRange(verdict.subject.startDate, verdict.subject.endDate)}
            </p>
          </div>
          <Chip tone={copy.available ? 'accent' : 'neutral'}>{copy.baselineLabel}</Chip>
        </div>

        <div className="space-y-1 text-sm text-ink-muted">
          {copy.lines.map((line) => (
            <p key={line.plain} className="flex min-h-11 flex-wrap items-center gap-x-0 px-1 py-1">
              <SentenceParts parts={line.parts} onOpen={setEvidenceKey} />
            </p>
          ))}
        </div>

        {copy.balance && (
          <div
            className="mt-2 flex min-h-11 flex-wrap items-center px-1 py-1 text-sm text-ink-muted"
            role="region"
            aria-label="Muscle balance"
            data-balance-id={copy.balanceId}
          >
            <SentenceParts parts={copy.balance.parts} onOpen={setEvidenceKey} />
          </div>
        )}

        {copy.pulse && (
          <div className="mt-3 flex min-h-11 flex-wrap items-center border-t border-line px-1 pt-3 text-xs text-ink-subtle">
            <SentenceParts parts={copy.pulse.parts} onOpen={setEvidenceKey} />
          </div>
        )}
      </Card>

      <VerdictEvidenceSheet
        open={evidenceKey !== null}
        onClose={() => setEvidenceKey(null)}
        verdict={verdict}
        weightUnit={weightUnit}
        focusKey={evidenceKey ?? undefined}
        muscleBalance={muscleBalance}
      />
    </section>
  );
}

function SentenceParts({
  parts,
  onOpen,
}: {
  parts: SentencePart[];
  onOpen: (key: VerdictEvidenceKey) => void;
}) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'metric' && part.evidenceKey) {
          return (
            <button
              key={`${part.text}-${index}`}
              type="button"
              className="mx-0.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded px-1.5 font-semibold tabular-nums text-ink underline decoration-accent/50 underline-offset-2 transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => onOpen(part.evidenceKey!)}
              aria-label={`${part.text}. Show evidence`}
            >
              {part.text}
            </button>
          );
        }
        return <span key={`${part.text}-${index}`}>{part.text}</span>;
      })}
    </>
  );
}
