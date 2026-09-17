import { useState } from 'react';
import { Card, Chip } from '@/components/ui';
import type { WeightUnit } from '@/domain/units';
import { VerdictEvidenceSheet, formatDateRange } from './VerdictEvidenceSheet';
import { weeklyVerdictCopy, type WeeklyVerdict } from './weeklyVerdict';

export function WeeklyVerdictCard({
  verdict,
  weightUnit,
}: {
  verdict: WeeklyVerdict;
  weightUnit: WeightUnit;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const copy = weeklyVerdictCopy(verdict, weightUnit);

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
            <button
              key={line}
              type="button"
              className="flex min-h-11 w-full items-center rounded px-1 text-left transition hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => setEvidenceOpen(true)}
              aria-label={`${line} Show evidence`}
            >
              <span className="flex-1">{line}</span>
              <span aria-hidden="true" className="ml-2 text-xs text-accent">
                ›
              </span>
            </button>
          ))}
        </div>

        {copy.pulseLine && (
          <button
            type="button"
            className="mt-3 flex min-h-11 w-full items-center rounded border-t border-line pt-3 text-left text-xs text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setEvidenceOpen(true)}
            aria-label={`${copy.pulseLine} Show same-span evidence`}
          >
            <span className="flex-1">{copy.pulseLine}</span>
            <span aria-hidden="true" className="ml-2 text-accent">
              ›
            </span>
          </button>
        )}
      </Card>

      <VerdictEvidenceSheet
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        verdict={verdict}
        weightUnit={weightUnit}
      />
    </section>
  );
}
