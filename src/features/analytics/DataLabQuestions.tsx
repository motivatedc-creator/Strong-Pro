import { cx } from '@/components/ui';

export type DataLabQuestion = 'stronger' | 'enough' | 'consistent' | 'change' | 'last_week';

const QUESTIONS: Array<{
  id: DataLabQuestion;
  question: string;
  answer: string;
  comingSoon?: boolean;
}> = [
  { id: 'stronger', question: 'Am I getting stronger?', answer: 'Strength trends and rep records' },
  { id: 'enough', question: 'Am I training enough?', answer: 'Hard sets by muscle this week' },
  { id: 'consistent', question: 'Am I consistent?', answer: 'Sessions and training history' },
  {
    id: 'change',
    question: 'What should I change?',
    answer: 'Stall, spike and deload flags',
  },
  { id: 'last_week', question: 'How did last week go?', answer: 'Your Weekly Verdict above' },
];

export function DataLabQuestions({
  selected,
  onSelect,
}: {
  selected: DataLabQuestion | null;
  onSelect: (question: DataLabQuestion) => void;
}) {
  return (
    <section className="mb-4" aria-labelledby="data-lab-questions-heading">
      <div className="mb-2">
        <h2 id="data-lab-questions-heading" className="text-base font-semibold text-ink">
          What do you want to know?
        </h2>
        <p className="text-xs text-ink-muted">Pick a question. Data Lab shows the answer first.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {QUESTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected === item.id}
            disabled={item.comingSoon}
            onClick={() => onSelect(item.id)}
            className={cx(
              'min-h-20 rounded-2xl p-3.5 text-left transition-[background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-70',
              selected === item.id
                ? 'bg-accent/12 shadow-[inset_0_0_0_1px_rgb(var(--rf-accent)/0.55)]'
                : 'bg-surface',
            )}
            style={selected === item.id ? undefined : { boxShadow: 'var(--shadow-border)' }}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{item.question}</span>
              {item.comingSoon && (
                <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                  Coming soon
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs text-ink-muted">{item.answer}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
