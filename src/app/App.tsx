import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getRepository } from '@/db/dexieRepository';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button, Spinner } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { SettingsProvider } from './SettingsProvider';
import { AppShell } from './AppShell';
import { TodayPage } from '@/features/workouts/TodayPage';
import { ActiveWorkoutPage } from '@/features/workouts/ActiveWorkoutPage';
import { WorkoutSummaryPage } from '@/features/workouts/WorkoutSummaryPage';
import { HistoryPage } from '@/features/workouts/HistoryPage';
import { WorkoutDetailPage } from '@/features/workouts/WorkoutDetailPage';
import { TemplatesPage } from '@/features/templates/TemplatesPage';
import { TemplateEditorPage } from '@/features/templates/TemplateEditorPage';
import { ExerciseLibraryPage } from '@/features/exercises/ExerciseLibraryPage';
import { MeasurementsPage } from '@/features/measurements/MeasurementsPage';
import { ToolsPage } from '@/features/calculators/ToolsPage';
import { PlateCalculatorPage } from '@/features/calculators/PlateCalculatorPage';
import { WarmupGeneratorPage } from '@/features/calculators/WarmupGeneratorPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ImportWizardPage } from '@/features/data-transfer/ImportWizardPage';
import { MorePage } from '@/features/settings/MorePage';
import { OnboardingPage } from '@/features/settings/OnboardingPage';

// Chart-heavy screens are code-split: the charting library is a large dependency and the
// logging path (Today -> active workout) must not pay for it on first load.
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const ExerciseDetailPage = lazy(() =>
  import('@/features/exercises/ExerciseDetailPage').then((module) => ({
    default: module.ExerciseDetailPage,
  })),
);
const MeasurementDetailPage = lazy(() =>
  import('@/features/measurements/MeasurementDetailPage').then((module) => ({
    default: module.MeasurementDetailPage,
  })),
);

/**
 * Boots the database before rendering anything that reads from it, and turns an
 * initialisation or migration failure into an explained, recoverable screen rather than
 * a blank page.
 */
function DatabaseGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .initialise()
      .then(() => {
        if (!cancelled) setState('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <Spinner label="Opening your local database" />
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-ink-subtle">
          <Icon icon={Icons.database} size={26} />
        </span>
        <h1 className="text-lg font-bold text-ink">Certified could not open its local database</h1>
        <p className="text-sm text-ink-muted">
          This usually means the browser is blocking storage (private browsing, or site data
          disabled), or a migration was interrupted. Your existing data has not been deleted.
        </p>
        <pre className="max-h-32 w-full overflow-auto rounded border border-line bg-surface-raised p-3 text-left text-xs text-ink-muted">
          {error}
        </pre>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <ErrorBoundary>
      <DatabaseGate>
        <SettingsProvider>
          <a
            href="#main"
            className="rf-sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
          >
            Skip to content
          </a>
          <Suspense fallback={<Spinner label="Loading" />}>
            <Routes>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route element={<AppShell />}>
                <Route index element={<TodayPage />} />
                <Route path="workout" element={<ActiveWorkoutPage />} />
                <Route path="workout/:id/summary" element={<WorkoutSummaryPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="templates/:id" element={<TemplateEditorPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="history/:id" element={<WorkoutDetailPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="exercises" element={<ExerciseLibraryPage />} />
                <Route path="exercises/:id" element={<ExerciseDetailPage />} />
                <Route path="measurements" element={<MeasurementsPage />} />
                <Route path="measurements/:metric" element={<MeasurementDetailPage />} />
                <Route path="tools" element={<ToolsPage />} />
                <Route path="tools/plates" element={<PlateCalculatorPage />} />
                <Route path="tools/warmup" element={<WarmupGeneratorPage />} />
                <Route path="more" element={<MorePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/import" element={<ImportWizardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </SettingsProvider>
      </DatabaseGate>
    </ErrorBoundary>
  );
}
