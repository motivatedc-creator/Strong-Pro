import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { Button, EmptyState, PageHeader, Sheet, Spinner } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { localDateOf, previousRange, resolveRange, type RangeKey } from '@/domain/time';
import type { OneRepMaxFormula } from '@/domain/types';
import { formatCompactNumber, fromGrams } from '@/domain/units';
import {
  bucketVolume,
  exerciseOptions,
  exerciseProgress,
  filterByRange,
  muscleBreakdown,
  percentChange,
  summarise,
  type LoggedEntry,
} from './compute';
import { DataLabQuestions, type DataLabQuestion } from './DataLabQuestions';
import { AskLabEntry } from './AskLabEntry';
import { AnalyticsDetailedCharts } from './AnalyticsDetailedCharts';
import { MuscleSetsCard } from './MuscleSetsCard';
import { muscleBandBalance } from './muscleSets';
import { WeeklyVerdictCard } from './WeeklyVerdictCard';
import { weeklyVerdict } from './weeklyVerdict';

/** Data Lab: answers first, with the existing analytics available as inspectable evidence. */
export function AnalyticsPage() {
  const { settings, weightUnit, update } = useSettings();
  const [range, setRange] = useState<RangeKey>('12w');
  const [formulaOverride, setFormulaOverride] = useState<OneRepMaxFormula | null>(null);
  const [includeWarmups, setIncludeWarmups] = useState(!settings.excludeWarmupsFromAnalytics);
  const [exerciseId, setExerciseId] = useState<string>('');
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const [help, setHelp] = useState<{ title: string; lines: string[] } | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<DataLabQuestion | null>(null);
  const [showDetailedAnalytics, setShowDetailedAnalytics] = useState(false);

  const formula = formulaOverride ?? settings.oneRepMaxFormula;
  const options = useMemo(
    () => ({ formula, includeWarmups, secondaryCredit: settings.secondaryMuscleCredit }),
    [formula, includeWarmups, settings.secondaryMuscleCredit],
  );

  const { data, loading } = useRepositoryData(async (repository) => {
    const entries = await repository.getAllCompletedSets();
    return entries as LoggedEntry[];
  }, []);

  const view = useMemo(() => {
    const entries = data ?? [];
    const weekStart = settings.weekStartDay ?? 'monday';
    const current = filterByRange(entries, resolveRange(range, new Date(), weekStart));
    const previous = previousRange(range, new Date(), weekStart);
    const priorEntries = previous ? filterByRange(entries, previous) : [];

    const summary = summarise(current, options);
    const priorSummary = summarise(priorEntries, options);
    const weekVerdict = weeklyVerdict(entries, options, weekStart);
    const effectiveGranularity = range === 'all' ? 'month' : granularity;
    const buckets = bucketVolume(current, effectiveGranularity, options);
    const muscles = muscleBreakdown(current, options);
    const muscleBandOptions = {
      weekStart,
      secondaryCredit: settings.secondaryMuscleCredit,
      personalTargetBands: settings.personalMuscleTargets,
    };
    // Current training week — Data Lab / MuscleSetsCard
    const currentWeekBalance = muscleBandBalance(entries, {
      ...muscleBandOptions,
      referenceLocalDate: localDateOf(),
    });
    // Subject (last completed) week — Weekly Verdict balance slot
    const subjectWeekBalance = muscleBandBalance(entries, {
      ...muscleBandOptions,
      referenceLocalDate: weekVerdict.subject.endDate,
    });
    const muscleSets = currentWeekBalance.insights;
    const exercises = exerciseOptions(entries);
    const selectedId = exerciseId || exercises[0]?.id || '';
    const progress = selectedId ? exerciseProgress(current, selectedId, options) : null;

    return {
      entries,
      current,
      summary,
      priorSummary,
      weekVerdict,
      subjectWeekBalance,
      buckets,
      effectiveGranularity,
      muscles,
      muscleSets,
      exercises,
      selectedId,
      progress,
    };
  }, [
    data,
    range,
    options,
    granularity,
    exerciseId,
    settings.weekStartDay,
    settings.secondaryMuscleCredit,
    settings.personalMuscleTargets,
  ]);

  const formatWeightValue = (grams: number) => formatCompactNumber(fromGrams(grams, weightUnit));

  if (loading && !data) return <Spinner label="Crunching your numbers" />;

  if (view.entries.length === 0) {
    return (
      <>
        <PageHeader title="Data Lab" subtitle="Your data, explained." />
        <EmptyState
          title="No completed workouts yet"
          description="Data Lab learns from completed workouts. Finish a session — or import your Strong history — and your answers will appear here."
          icon={<Icon icon={Icons.chart} size={22} />}
          action={
            <Link to="/settings/import" className="text-sm font-semibold text-accent">
              Import a Strong CSV
            </Link>
          }
        />
      </>
    );
  }

  const volumeChange = percentChange(view.summary.volumeG, view.priorSummary.volumeG);
  const setsChange = percentChange(view.summary.completedSets, view.priorSummary.completedSets);
  const selectedExercise = view.exercises.find((entry) => entry.id === view.selectedId);
  return (
    <>
      <PageHeader title="Data Lab" subtitle="Your data, explained." />

      <WeeklyVerdictCard verdict={view.weekVerdict} weightUnit={weightUnit} muscleBalance={view.subjectWeekBalance} />

      <DataLabQuestions
        selected={selectedQuestion}
        onSelect={(question) => {
          setSelectedQuestion(question);
          if (question === 'stronger' || question === 'consistent') {
            setShowDetailedAnalytics(true);
          }
        }}
      />

      {selectedQuestion === 'enough' && (
        <MuscleSetsCard
          insights={view.muscleSets}
          secondaryCredit={settings.secondaryMuscleCredit}
          weightUnit={weightUnit}
          personalTargets={settings.personalMuscleTargets}
          onPersonalTargetsChange={(personalMuscleTargets) =>
            void update({ personalMuscleTargets })
          }
        />
      )}

      <AskLabEntry
        entries={view.entries}
        weekStart={settings.weekStartDay ?? 'monday'}
        secondaryCredit={settings.secondaryMuscleCredit}
        personalTargetBands={settings.personalMuscleTargets}
        formula={formula}
        includeWarmups={includeWarmups}
        weightUnit={weightUnit}
      />

      <Button
        block
        variant="secondary"
        className="mb-4"
        aria-expanded={showDetailedAnalytics}
        aria-controls="detailed-analytics"
        onClick={() => setShowDetailedAnalytics((visible) => !visible)}
      >
        {showDetailedAnalytics ? 'Hide detailed charts' : 'Explore detailed charts'}
      </Button>

      {showDetailedAnalytics && (
        <AnalyticsDetailedCharts
          range={range}
          setRange={setRange}
          formula={formula}
          setFormulaOverride={setFormulaOverride}
          settingsFormula={settings.oneRepMaxFormula}
          includeWarmups={includeWarmups}
          setIncludeWarmups={setIncludeWarmups}
          granularity={granularity}
          setGranularity={setGranularity}
          setExerciseId={setExerciseId}
          weightUnit={weightUnit}
          view={view}
          formatWeightValue={formatWeightValue}
          setHelp={setHelp}
          volumeChange={volumeChange}
          setsChange={setsChange}
          selectedExercise={selectedExercise}
        />
      )}

      <Sheet open={!!help} onClose={() => setHelp(null)} title={help?.title ?? ''}>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-muted">
          {help?.lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </Sheet>

      <div className="h-8" aria-hidden="true" />
    </>
  );
}
