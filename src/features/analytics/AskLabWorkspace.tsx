import { useState } from 'react';
import { Button, Card, Sheet, cx } from '@/components/ui';
import type { EvidenceClaim, EvidenceKind } from '@/domain/evidence';
import { ClaimEvidenceSheet } from './ClaimEvidenceSheet';
import { ASK_LAB_STARTERS, answerAskLab, type AskLabAnswer } from './askLab';

const KIND_LABEL: Record<EvidenceKind, string> = {
  evidence_backed_default: 'Research default',
  implementation_heuristic: 'Implementation heuristic',
  user_editable_personal: 'Personal target',
  pure_calculation: 'Pure calculation',
};

export function AskLabWorkspace({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState<AskLabAnswer | null>(null);
  const [detailClaim, setDetailClaim] = useState<EvidenceClaim | null>(null);

  const canAsk = draft.trim().length > 0;

  const submit = (query: string) => {
    const next = answerAskLab(query);
    setDraft(query);
    setAnswer(next);
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Ask the Lab"
        description="Answers from the shared evidence layer — same receipts as Data Lab."
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
              placeholder="e.g. Why 10–20 credited sets?"
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
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                  {answer.refused ? 'No receipt' : 'Call'}
                </p>
                <p className="mt-1 font-medium text-ink">{answer.call}</p>
              </div>

              {!answer.refused && (
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
                        <span className="block text-sm font-semibold text-ink">{claim.statement}</span>
                        <span className="mt-1 inline-flex rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                          {KIND_LABEL[claim.kind]}
                        </span>
                        <span className="mt-1 block text-[11px] text-accent">Open receipt</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {answer.refused && (
                <p className="text-xs text-ink-muted">
                  Ask the Lab will not invent papers. If this should be answerable, add it to the
                  evidence catalog first.
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
