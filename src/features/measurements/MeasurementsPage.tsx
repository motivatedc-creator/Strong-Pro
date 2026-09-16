import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository, useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  EmptyState,
  Field,
  NumberInput,
  PageHeader,
  Select,
  Sheet,
  Spinner,
  TextArea,
} from '@/components/ui';
import { MEASUREMENT_METRICS, metricKind, metricLabel } from '@/domain/taxonomy';
import { localDateOf, relativeDay } from '@/domain/time';
import type { BodyMeasurement, MeasurementMetric } from '@/domain/types';
import { formatLength, formatWeight, toGrams, toMillimetres } from '@/domain/units';

/** Plausibility bounds. Out-of-range values warn but are never rejected. */
const PLAUSIBLE = {
  bodyweightKg: { min: 25, max: 400 },
  lengthCm: { min: 5, max: 250 },
};

/** Body measurements: quick entry, per-metric trends, editing and deletion. */
export function MeasurementsPage() {
  const repository = useRepository();
  const { weightUnit, lengthUnit } = useSettings();
  const [entryFor, setEntryFor] = useState<MeasurementMetric | null>(null);
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);

  const { data, loading, reload } = useRepositoryData((repo) => repo.listMeasurements(), []);

  const latest = useMemo(() => {
    const map = new Map<MeasurementMetric, BodyMeasurement>();
    for (const measurement of data ?? []) {
      const existing = map.get(measurement.metric);
      if (!existing || measurement.recordedAt > existing.recordedAt)
        map.set(measurement.metric, measurement);
    }
    return map;
  }, [data]);

  const format = (measurement: BodyMeasurement) =>
    metricKind(measurement.metric) === 'mass'
      ? `${formatWeight(measurement.value, weightUnit)} ${weightUnit}`
      : `${formatLength(measurement.value, lengthUnit)} ${lengthUnit}`;

  return (
    <>
      <PageHeader
        title="Measurements"
        subtitle="Stored on this device in canonical units and converted for display."
      />

      {loading && !data && <Spinner label="Loading measurements" />}

      {!loading && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="No measurements yet"
          description="Track body weight and circumferences to see trends and weekly change alongside your lifting."
          icon="📏"
          action={
            <Button variant="primary" onClick={() => setEntryFor('bodyweight')}>
              Log body weight
            </Button>
          }
        />
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {MEASUREMENT_METRICS.map((metric) => {
          const current = latest.get(metric.value);
          return (
            <li key={metric.value}>
              <Card className="flex items-center justify-between gap-2 p-3">
                <Link to={`/measurements/${metric.value}`} className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{metric.label}</span>
                  <span className="block text-xs text-ink-subtle">
                    {current
                      ? `${format(current)} · ${relativeDay(current.recordedAt)}`
                      : 'No entries yet'}
                  </span>
                </Link>
                <Button size="sm" onClick={() => setEntryFor(metric.value)}>
                  Log
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
        Recent entries
      </h2>
      <ul className="space-y-1.5">
        {(data ?? []).slice(0, 25).map((measurement) => (
          <li key={measurement.id}>
            <button
              type="button"
              onClick={() => setEditing(measurement)}
              className="rf-card flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {metricLabel(measurement.metric)}
                </span>
                <span className="block text-xs text-ink-subtle">
                  {relativeDay(measurement.recordedAt)}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                {format(measurement)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <MeasurementEntrySheet
        open={!!entryFor || !!editing}
        metric={editing?.metric ?? entryFor ?? 'bodyweight'}
        existing={editing ?? undefined}
        onClose={() => {
          setEntryFor(null);
          setEditing(null);
        }}
        onSaved={reload}
        onDelete={
          editing
            ? async () => {
                await repository.deleteMeasurement(editing.id);
                toast.info('Measurement deleted.');
                setEditing(null);
                reload();
              }
            : undefined
        }
      />

      <div className="h-8" aria-hidden="true" />
    </>
  );
}

export function MeasurementEntrySheet({
  open,
  metric,
  existing,
  onClose,
  onSaved,
  onDelete,
}: {
  open: boolean;
  metric: MeasurementMetric;
  existing?: BodyMeasurement;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => Promise<void>;
}) {
  const repository = useRepository();
  const { weightUnit, lengthUnit } = useSettings();
  const kind = metricKind(metric);
  const unit = kind === 'mass' ? weightUnit : lengthUnit;

  const [value, setValue] = useState('');
  const [date, setDate] = useState(localDateOf());
  const [note, setNote] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<MeasurementMetric>(metric);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');

  // Reset the form each time the sheet opens for a different metric or entry.
  const [initialisedFor, setInitialisedFor] = useState<string | null>(null);
  const key = `${existing?.id ?? 'new'}-${metric}-${open}`;
  if (open && initialisedFor !== key) {
    setInitialisedFor(key);
    setSelectedMetric(existing?.metric ?? metric);
    setValue(
      existing
        ? metricKind(existing.metric) === 'mass'
          ? formatWeight(existing.value, weightUnit)
          : formatLength(existing.value, lengthUnit)
        : '',
    );
    setDate(existing ? existing.localDate : localDateOf());
    setNote(existing?.note ?? '');
    setWarning('');
    setError('');
  }

  const save = async () => {
    const numeric = Number.parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a positive number.');
      return;
    }
    setError('');

    const activeKind = metricKind(selectedMetric);
    const canonical =
      activeKind === 'mass' ? toGrams(numeric, weightUnit) : toMillimetres(numeric, lengthUnit);

    const recordedAt = new Date(`${date}T12:00:00`);
    const payload = {
      metric: selectedMetric,
      value: canonical,
      displayUnit: (activeKind === 'mass'
        ? weightUnit
        : lengthUnit) as BodyMeasurement['displayUnit'],
      recordedAt: (Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt).toISOString(),
      localDate: date,
      note: note.trim() || undefined,
    };

    if (existing) await repository.updateMeasurement(existing.id, payload);
    else await repository.addMeasurement(payload);

    toast.success(existing ? 'Measurement updated.' : 'Measurement saved.');
    onSaved();
    onClose();
  };

  const checkPlausible = (raw: string) => {
    const numeric = Number.parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(numeric)) return;
    const activeKind = metricKind(selectedMetric);
    if (activeKind === 'mass') {
      const kg = weightUnit === 'kg' ? numeric : numeric * 0.45359237;
      setWarning(
        kg < PLAUSIBLE.bodyweightKg.min || kg > PLAUSIBLE.bodyweightKg.max
          ? 'That is outside the usual range — saved anyway if you meant it.'
          : '',
      );
      return;
    }
    const cm = lengthUnit === 'cm' ? numeric : numeric * 2.54;
    setWarning(
      cm < PLAUSIBLE.lengthCm.min || cm > PLAUSIBLE.lengthCm.max
        ? 'That is outside the usual range — saved anyway if you meant it.'
        : '',
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        existing ? `Edit ${metricLabel(selectedMetric)}` : `Log ${metricLabel(selectedMetric)}`
      }
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="danger" onClick={() => void onDelete()}>
              Delete
            </Button>
          )}
          <Button block onClick={onClose}>
            Cancel
          </Button>
          <Button block variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <Field label="Metric">
        {({ id }) => (
          <Select
            id={id}
            value={selectedMetric}
            onChange={(event) => setSelectedMetric(event.target.value as MeasurementMetric)}
          >
            {MEASUREMENT_METRICS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label={`Value (${unit})`} error={error} hint={warning || undefined}>
        {({ id, describedBy }) => (
          <NumberInput
            id={id}
            aria-describedby={describedBy}
            data-autofocus
            value={value}
            step="any"
            min={0}
            onChange={(event) => {
              setValue(event.target.value);
              checkPlausible(event.target.value);
            }}
          />
        )}
      </Field>

      <Field label="Date">
        {({ id }) => (
          <input
            id={id}
            type="date"
            className="rf-input"
            value={date}
            max={localDateOf()}
            onChange={(event) => setDate(event.target.value)}
          />
        )}
      </Field>

      <Field label="Note">
        {({ id }) => (
          <TextArea
            id={id}
            value={note}
            maxLength={500}
            placeholder="Morning, fasted, post-holiday…"
            onChange={(event) => setNote(event.target.value)}
          />
        )}
      </Field>
    </Sheet>
  );
}
