import { Button, Card, Sheet, cx } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import type { BarProfile } from '@/domain/types';
import { formatWeight, fromGrams, type WeightUnit } from '@/domain/units';
import type { PlateStackItem } from '@/domain/plateCalculator';

export function describeBar(bar: BarProfile, weightUnit: WeightUnit): string {
  const name = bar.name.toLowerCase();
  if (name.includes('ez') || name.includes('curl')) {
    return 'Short angled curl bar; weight varies by model.';
  }
  if (name.includes('trap') || name.includes('hex')) {
    return 'Hex-shaped specialty bar; weight varies widely.';
  }
  if (name.includes('smith')) {
    return 'Machine bar; the effective starting weight varies.';
  }
  if (name.includes('technique') || name.includes('training')) {
    return 'Light practice bar; confirm the printed weight.';
  }

  const kilograms = fromGrams(bar.weightG, 'kg');
  if (Math.abs(kilograms - 20) < 0.25) {
    return 'Full-size Olympic bar; common in commercial gyms.';
  }
  if (Math.abs(kilograms - 15) < 0.25) {
    return 'Lighter Olympic bar; usually shorter with a thinner shaft.';
  }
  return `${formatWeight(bar.weightG, weightUnit)} ${weightUnit} custom bar; check its label or end cap.`;
}

export function BarPicker({
  bars,
  value,
  weightUnit,
  onChange,
}: {
  bars: readonly BarProfile[];
  value: string;
  weightUnit: WeightUnit;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="mb-4">
      <legend className="rf-label">Choose your bar</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {bars.map((bar) => {
          const selected = bar.id === value;
          return (
            <button
              key={bar.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(bar.id)}
              className={cx(
                'min-h-20 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                selected
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-surface hover:border-accent/50',
              )}
            >
              <span className="flex items-center gap-3">
                <MiniBarIllustration weightG={bar.weightG} selected={selected} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{bar.name}</span>
                  <span className="block text-xs font-medium text-accent">
                    {formatWeight(bar.weightG, weightUnit)} {weightUnit}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                    selected ? 'border-accent bg-accent text-accent-ink' : 'border-line',
                  )}
                >
                  {selected ? <Icon icon={Icons.check} size={14} strokeWidth={2.5} /> : null}
                </span>
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-ink-muted">
                {describeBar(bar, weightUnit)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MiniBarIllustration({ weightG, selected }: { weightG: number; selected: boolean }) {
  const kilograms = fromGrams(weightG, 'kg');
  const gripWidth = kilograms >= 18 ? 48 : kilograms >= 13 ? 40 : 31;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 76 34"
      className={cx('h-10 w-20 shrink-0', selected ? 'text-accent' : 'text-ink-subtle')}
    >
      <rect x="5" y="15" width="66" height="4" rx="2" fill="currentColor" opacity="0.55" />
      <rect
        x={(76 - gripWidth) / 2}
        y="13"
        width={gripWidth}
        height="8"
        rx="3"
        fill="currentColor"
      />
      <rect x="4" y="9" width="5" height="16" rx="2" fill="currentColor" />
      <rect x="67" y="9" width="5" height="16" rx="2" fill="currentColor" />
    </svg>
  );
}

export function BarbellDiagram({
  perSide,
  barWeightG,
  achievedTotalG,
  weightUnit,
}: {
  perSide: readonly PlateStackItem[];
  barWeightG: number;
  achievedTotalG: number;
  weightUnit: WeightUnit;
}) {
  const plates = perSide.flatMap((item) =>
    Array.from({ length: item.countPerSide }, () => item.weightG),
  );
  const perSideG = Math.max(0, (achievedTotalG - barWeightG) / 2);
  const plateWidth = Math.max(5, Math.min(12, plates.length === 0 ? 12 : 70 / plates.length));

  return (
    <figure className="mt-3 rounded-lg border border-line bg-surface-raised p-3">
      <svg
        role="img"
        aria-label={`${formatWeight(achievedTotalG, weightUnit)} ${weightUnit} barbell. ${formatWeight(perSideG, weightUnit)} ${weightUnit} of plates on each side.`}
        viewBox="0 0 360 150"
        className="h-auto w-full text-ink"
      >
        <rect x="112" y="68" width="136" height="14" rx="6" fill="currentColor" opacity="0.9" />
        <rect x="22" y="72" width="316" height="6" rx="3" fill="currentColor" opacity="0.48" />
        <rect x="104" y="58" width="9" height="34" rx="3" fill="currentColor" opacity="0.72" />
        <rect x="247" y="58" width="9" height="34" rx="3" fill="currentColor" opacity="0.72" />
        {plates.map((weightG, index) => {
          const height = Math.max(42, Math.min(112, 38 + fromGrams(weightG, 'kg') * 2.7));
          const y = 75 - height / 2;
          const leftX = 101 - (index + 1) * (plateWidth + 2);
          const rightX = 259 + index * (plateWidth + 2);
          const opacity = 0.58 + (index % 3) * 0.16;
          return (
            <g key={`${weightG}-${index}`}>
              <rect
                x={leftX}
                y={y}
                width={plateWidth}
                height={height}
                rx="3"
                fill="currentColor"
                opacity={opacity}
              />
              <rect
                x={rightX}
                y={y}
                width={plateWidth}
                height={height}
                rx="3"
                fill="currentColor"
                opacity={opacity}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-ink">
          {formatWeight(perSideG, weightUnit)} {weightUnit} per side
        </span>
        <span className="text-ink-muted">
          {formatWeight(achievedTotalG, weightUnit)} {weightUnit} total
        </span>
      </figcaption>
    </figure>
  );
}

export function BeginnerPlateGuide({ weightUnit }: { weightUnit: WeightUnit }) {
  const target = weightUnit === 'kg' ? '100 kg' : '225 lb';
  const bar = weightUnit === 'kg' ? '20 kg' : '45 lb';
  const remaining = weightUnit === 'kg' ? '80 kg' : '180 lb';
  const side = weightUnit === 'kg' ? '40 kg' : '90 lb';
  return (
    <details className="mb-4 rounded-lg border border-line bg-surface-raised">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-ink">
        <span aria-hidden="true">💡</span>
        New to loading a bar? See an example
      </summary>
      <div className="border-t border-line px-3 py-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <GuideStep number="1" label={`${target} total`} detail={`includes the ${bar} bar`} />
          <GuideStep number="2" label={`${remaining} left`} detail="after subtracting the bar" />
          <GuideStep number="3" label={`${side} per side`} detail="load the same on both ends" />
        </div>
        <p className="mt-3 text-xs text-ink-muted">
          Enter the total weight you want to lift. The calculator subtracts the bar and collars,
          splits the rest evenly, then uses plates from your selected inventory.
        </p>
      </div>
    </details>
  );
}

function GuideStep({ number, label, detail }: { number: string; label: string; detail: string }) {
  return (
    <div className="rounded border border-line bg-surface p-2">
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">
        {number}
      </span>
      <p className="mt-1 text-xs font-semibold text-ink">{label}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-subtle">{detail}</p>
    </div>
  );
}

export function UnknownBarHelper({
  open,
  bars,
  weightUnit,
  onChoose,
  onClose,
}: {
  open: boolean;
  bars: readonly BarProfile[];
  weightUnit: WeightUnit;
  onChoose: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Which bar am I using?"
      description="A quick check before the calculator does the maths."
    >
      <div className="space-y-3 text-sm">
        <Card className="border-warning/40 bg-warning/10 p-3">
          <p className="font-semibold text-ink">Do not guess if the number matters.</p>
          <p className="mt-1 text-ink-muted">
            Look for a printed weight on the end cap or collar. If there is no label, check the rack
            sign, ask the gym staff, or weigh the bar.
          </p>
        </Card>
        <ul className="space-y-2 text-ink-muted">
          <li>
            <strong className="text-ink">Usually 20 kg / 45 lb:</strong> full-length Olympic bar
            with thick rotating sleeves.
          </li>
          <li>
            <strong className="text-ink">Usually 15 kg / 33 lb:</strong> slightly shorter bar with a
            thinner shaft.
          </li>
          <li>
            <strong className="text-ink">Never assume:</strong> EZ, trap, safety-squat, Smith and
            short bars vary by model.
          </li>
        </ul>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
            Choose a configured bar
          </p>
          <div className="space-y-2">
            {bars.map((bar) => (
              <Button key={bar.id} block variant="secondary" onClick={() => onChoose(bar.id)}>
                Choose {bar.name} · {formatWeight(bar.weightG, weightUnit)} {weightUnit}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
