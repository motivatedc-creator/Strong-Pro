import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import type { OneRepMaxFormula, PersonalMuscleTargets, WeekStartDay } from '@/domain/types';
import type { WeightUnit } from '@/domain/units';
import type { LoggedEntry } from './compute';
import { AskLabWorkspace } from './AskLabWorkspace';

export function AskLabEntry({
  entries,
  weekStart,
  secondaryCredit,
  personalTargetBands,
  formula,
  includeWarmups,
  weightUnit,
}: {
  entries: readonly LoggedEntry[];
  weekStart: WeekStartDay;
  secondaryCredit: number;
  personalTargetBands?: PersonalMuscleTargets;
  formula: OneRepMaxFormula;
  includeWarmups: boolean;
  weightUnit: WeightUnit;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Ask the Lab</p>
            <p className="mt-1 text-xs text-ink-muted">
              Questions about your logged training — plus Lock'd defaults — answered from
              app-computed data and the shared evidence layer.
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            Open Ask the Lab
          </Button>
        </div>
      </Card>
      <AskLabWorkspace
        open={open}
        onClose={() => setOpen(false)}
        weightUnit={weightUnit}
        context={{
          entries,
          weekStart,
          secondaryCredit,
          personalTargetBands,
          formula,
          includeWarmups,
          weightUnit,
        }}
      />
    </>
  );
}
