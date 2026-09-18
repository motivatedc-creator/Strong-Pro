import { useState } from 'react';
import { Button, Card, Sheet, cx } from '@/components/ui';
import type { EvidenceClaim, EvidenceKind } from '@/domain/evidence';
import { titleCase } from '@/domain/taxonomy';
import { formatCompactNumber, fromGrams, type WeightUnit } from '@/domain/units';
import { ClaimEvidenceSheet } from './ClaimEvidenceSheet';
import {
  ASK_LAB_STARTERS,
  EXPLORE_BADGE,
  answerAskLab,
  type AskLabAnswer,
  type AskLabContext,
  type AskLabTier,
} from './askLab';

const KIND_LABEL: Record<EvidenceKind, string> = {
  evidence_backed_default: 'Research default',
  implementation_heuristic: 'Implementation heuristic',
  user_editable_personal: 'Personal target',
  pure_calculation: 'Pure calculation',
};

const TIER_BADGE: Record<AskLabTier, string> = {
  computed: 'Computed',
  partial: 'Partial',
  explore: EXPLORE_BADGE,
};

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function AskLabWorkspace({
  open,
  onClose,
  context,
  weightUnit = 'kg',
}: {
  open: boolean;
  onClose: () => void;
  context?: AskLabContext;
  weightUnit?: WeightUnit;
}) {
  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState<AskLabAnswer | null>(null);
  const [detailClaim, setDetailClaim] = useState<EvidenceClaim | null>(null);

  const canAsk = draft.trim().length > 0;

  const submit = (query: string) => {
    const next = answerAskLab(query, context);
    setDraft(query);
    setAnswer(next);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Ask the Lab"
        description="Answers from your logged training and the shared evidence layer."
        size="lg"
      >
        <div className="space-y-4 pb-4 text-sm">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canAsk) return;
              submit(draft);
            }}
          >
            <input
              aria-label="Ask the Lab"
              placeholder="e.g. Am I training enough?"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-tap w-full flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink"
            />
            <Button type="submit" disabled={!canAsk}>
              Ask
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {ASK_LAB_STARTERS.map((starter) => (
              <Button
                key={starter.query}
                size="sm"
                variant="ghost"
                onClick={() => submit(starter.query)}
              >
                {starter.label}
              </Button>
            ))}
          </div>

          {answer && (
            <Card className="space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cx(
                    'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                    answer.tier === 'computed' && 'border-accent/40 text-accent',
                    answer.tier === 'partial' && 'border-line text-ink-muted',
                    answer.tier === 'explore' && 'border-line text-ink-subtle',
                  )}
                >
                  {TIER_BADGE[answer.tier]}
                </span>
                {answer.intent && (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                    {answer.intent.replaceAll('_', ' ')}
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Call</p>
                <p className="mt-1 font-medium text-ink">{answer.call}</p>
              </div>

              {answer.known && (
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Known: </span>
                  {answer.known}
                </p>
              )}
              {answer.missing && (
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Missing: </span>
                  {answer.missing}
                </p>
              )}
              {answer.nextStep && (
                <p className="text-xs text-ink-muted">
                  <span className="font-semibold text-ink">Next: </span>
                  {answer.nextStep}
                </p>
              )}

              {answer.payload?.kind === 'training_enough' &&
                answer.payload.muscles.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised px-3">
                    {answer.payload.muscles.slice(0, 8).map((row) => (
                      <li
                        key={row.muscle}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-ink">{titleCase(row.muscle)}</span>
                        <span className="font-mono tabular-nums text-ink-muted">
                          {row.targetMin != null && row.targetMax != null
                            ? `${formatSets(row.sets)} of ${formatSets(row.targetMin)}–${formatSets(row.targetMax)}`
                            : `${formatSets(row.sets)} credited`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

              {answer.payload?.kind === 'muscle_contribution' &&
                answer.payload.attributions.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised px-3">
                    {answer.payload.attributions.map((row) => (
                      <li
                        key={row.exerciseId}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-ink">{row.exerciseName}</span>
                        <span className="font-mono tabular-nums text-ink-muted">
                          {formatSets(row.creditedSets)} credited · {row.roles.join('/')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

              {answer.payload?.kind === 'getting_stronger' &&
                answer.payload.trends.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised px-3">
                    {answer.payload.trends.map((row) => (
                      <li
                        key={row.exerciseId}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-ink">{row.exerciseName}</span>
                        <span className="font-mono tabular-nums text-ink-muted">
                          {formatCompactNumber(fromGrams(row.firstE1rmG, weightUnit))} →{' '}
                          {formatCompactNumber(fromGrams(row.lastE1rmG, weightUnit))} {weightUnit}
                          {row.changePercent != null
                            ? ` (${row.changePercent >= 0 ? '+' : ''}${row.changePercent.toFixed(0)}%)`
                            : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

              {answer.payload?.kind === 'verdict_why' && (
                <p className="text-xs text-ink-subtle">
                  Subject week {answer.payload.subjectStartDate} → {answer.payload.subjectEndDate}{' '}
                  · state {answer.payload.verdict.state.replaceAll('_', ' ')}
                </p>
              )}

              {answer.payload?.kind === 'change_flags' &&
                answer.payload.activeLabels.length > 0 && (
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface-raised px-3">
                    {answer.payload.activeLabels.map((label, index) => (
                      <li key={label} className="py-2 text-sm">
                        <p className="font-semibold text-ink">{label}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {answer.payload?.kind === 'change_flags'
                            ? answer.payload.receipts[index]
                            : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

              {answer.matches.length > 0 && (
                <ul className="space-y-2" aria-label="Cited claims">
                  {answer.matches.map(({ claim }) => (
                    <li key={claim.id}>
                      <button
                        type="button"
                        className={cx(
                          'w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-left',
                          'transition-colors hover:bg-surface',
                        )}
                        onClick={() => setDetailClaim(claim)}
                      >
                        <span className="block text-sm font-semibold text-ink">
                          {claim.statement}
                        </span>
                        <span className="mt-1 inline-flex rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                          {KIND_LABEL[claim.kind]}
                        </span>
                        <span className="mt-1 block text-[11px] text-accent">Open receipt</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {answer.tier === 'explore' && (
                <p className="text-xs text-ink-muted">
                  Ask the Lab will not invent papers or training metrics. Starter chips cover your
                  logged work; research defaults stay on the shared evidence layer.
                </p>
              )}
            </Card>
          )}
        </div>
      </Sheet>

      {detailClaim && (
        <ClaimEvidenceSheet
          open={!!detailClaim}
          onClose={() => setDetailClaim(null)}
          claim={detailClaim}
          title="Claim receipt"
        />
      )}
    </>
  );
}
