import { useEffect, useMemo, useState } from 'react';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { Button, Field, NumberInput, Select, Toggle, cx } from '@/components/ui';
import { calculatePlates, type PlateCalculatorResult } from '@/domain/plateCalculator';
import type { BarProfile, PlateInventory } from '@/domain/types';
import { formatWeight, fromGrams, toGrams, trimNumber } from '@/domain/units';

/**
 * Plate calculator UI. The maths lives in domain/plateCalculator.ts; this panel only
 * gathers inputs and renders the result, including a text equivalent of the visual stack.
 */
export function PlateCalculatorPanel({
  initialTargetG,
  onApply,
  applyLabel = 'Use this weight',
}: {
  initialTargetG?: number;
  onApply?: (weightG: number) => void;
  applyLabel?: string;
}) {
  const { settings, weightUnit, update } = useSettings();
  const { data } = useRepositoryData(
    async (repository) => ({
      bars: await repository.listBarProfiles(),
      inventories: await repository.listPlateInventories(),
    }),
    [],
  );

  // Memoised so the empty-array fallbacks do not create new effect dependencies each render.
  const bars = useMemo<BarProfile[]>(() => data?.bars ?? [], [data]);
  const inventories = useMemo<PlateInventory[]>(() => data?.inventories ?? [], [data]);

  const [barId, setBarId] = useState<string>('');
  const [inventoryId, setInventoryId] = useState<string>('');
  const [useCollars, setUseCollars] = useState(false);
  const [collarText, setCollarText] = useState('2.5');
  const [targetText, setTargetText] = useState(() =>
    initialTargetG !== undefined ? formatWeight(initialTargetG, weightUnit) : '',
  );

  useEffect(() => {
    if (!barId && bars.length > 0) {
      setBarId(
        settings.defaultBarProfileId ?? bars.find((bar) => bar.isDefault)?.id ?? bars[0]!.id,
      );
    }
    if (!inventoryId && inventories.length > 0) {
      setInventoryId(
        settings.defaultPlateInventoryId ??
          inventories.find((inventory) => inventory.isDefault)?.id ??
          inventories[0]!.id,
      );
    }
  }, [
    bars,
    inventories,
    barId,
    inventoryId,
    settings.defaultBarProfileId,
    settings.defaultPlateInventoryId,
  ]);

  const bar = bars.find((entry) => entry.id === barId);
  const inventory = inventories.find((entry) => entry.id === inventoryId);

  const targetG = useMemo(() => {
    const value = Number.parseFloat(targetText.replace(',', '.'));
    return Number.isFinite(value) ? toGrams(value, weightUnit) : Number.NaN;
  }, [targetText, weightUnit]);

  const result: PlateCalculatorResult | null = useMemo(() => {
    if (!bar || !inventory || !Number.isFinite(targetG)) return null;
    const collarWeightG = useCollars
      ? toGrams(Number.parseFloat(collarText || '0') || 0, weightUnit)
      : 0;
    return calculatePlates({
      targetTotalG: targetG,
      barWeightG: bar.weightG,
      collarWeightG,
      plates: inventory.plates,
    });
  }, [bar, inventory, targetG, useCollars, collarText, weightUnit]);

  const textResult = result
    ? result.perSide.length === 0
      ? result.message
      : `Per side: ${result.perSide
          .map(
            (item) =>
              `${item.countPerSide} × ${formatWeight(item.weightG, weightUnit)} ${weightUnit}`,
          )
          .join(', ')}. Total ${formatWeight(result.achievedTotalG, weightUnit)} ${weightUnit}.`
    : 'Enter a target weight.';

  return (
    <div>
      <Field label={`Target weight (${weightUnit})`}>
        {({ id }) => (
          <NumberInput
            id={id}
            data-autofocus
            value={targetText}
            step="any"
            min={0}
            onChange={(event) => setTargetText(event.target.value)}
            placeholder={weightUnit === 'kg' ? '100' : '225'}
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bar">
          {({ id }) => (
            <Select
              id={id}
              value={barId}
              onChange={(event) => {
                setBarId(event.target.value);
                void update({ defaultBarProfileId: event.target.value });
              }}
            >
              {bars.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {formatWeight(entry.weightG, weightUnit)} {weightUnit}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Plate inventory">
          {({ id }) => (
            <Select
              id={id}
              value={inventoryId}
              onChange={(event) => {
                setInventoryId(event.target.value);
                void update({ defaultPlateInventoryId: event.target.value });
              }}
            >
              {inventories.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Toggle
        label="Collars"
        description="Adds one collar per side to the loaded weight."
        checked={useCollars}
        onChange={setUseCollars}
      />
      {useCollars && (
        <Field label={`Collar weight, each (${weightUnit})`}>
          {({ id }) => (
            <NumberInput
              id={id}
              value={collarText}
              step="any"
              min={0}
              onChange={(event) => setCollarText(event.target.value)}
            />
          )}
        </Field>
      )}

      {inventory && (
        <p className="mb-4 text-xs text-ink-subtle">
          Counts are <strong>total physical plates</strong>, not pairs — {inventory.name} holds{' '}
          {inventory.plates
            .map((plate) => `${plate.count} × ${formatWeight(plate.weightG, weightUnit)}`)
            .join(', ')}{' '}
          {weightUnit}. Edit inventories in Settings → Equipment.
        </p>
      )}

      {result && (
        <div
          className={cx(
            'rounded-lg border p-4',
            result.status === 'exact'
              ? 'border-success/50 bg-success/10'
              : result.status === 'invalid'
                ? 'border-danger/50 bg-danger/10'
                : 'border-warning/50 bg-warning/10',
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span aria-hidden="true">
              {result.status === 'exact' ? '✓' : result.status === 'invalid' ? '✕' : '≈'}
            </span>
            {formatWeight(result.achievedTotalG, weightUnit)} {weightUnit}
            {result.differenceG !== 0 && Number.isFinite(targetG) && (
              <span className="font-normal text-ink-muted">
                ({result.differenceG > 0 ? '+' : ''}
                {trimNumber(Math.round(fromGrams(result.differenceG, weightUnit) * 100) / 100)}{' '}
                {weightUnit} vs target)
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{result.message}</p>

          {result.perSide.length > 0 && (
            <div className="mt-3" aria-hidden="true">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-subtle">
                Per side, from the collar out
              </p>
              <div className="flex items-end gap-1 overflow-x-auto pb-1">
                <span className="mr-1 h-3 w-8 shrink-0 rounded bg-ink-subtle" title="Bar" />
                {result.perSide.flatMap((item) =>
                  Array.from({ length: item.countPerSide }, (_, index) => (
                    <span
                      key={`${item.weightG}-${index}`}
                      className="flex w-10 shrink-0 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-ink"
                      style={{
                        height: `${Math.max(28, Math.min(84, 28 + fromGrams(item.weightG, 'kg') * 2.2))}px`,
                      }}
                    >
                      {formatWeight(item.weightG, weightUnit)}
                    </span>
                  )),
                )}
              </div>
            </div>
          )}

          <p className="mt-3 text-sm text-ink">{textResult}</p>

          {onApply && result.status !== 'invalid' && (
            <Button
              variant="primary"
              className="mt-3"
              block
              onClick={() => onApply(result.achievedTotalG)}
            >
              {applyLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
