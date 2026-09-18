import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/app/SettingsProvider';
import { Button, Card, Segmented } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { ACCENT_THEMES } from '@/platform/theme';
import { nowIso } from '@/domain/time';
import { defaultQuickIncrementG } from '@/domain/units';
import type {
  AccentTheme,
  IntensityMode,
  OneRepMaxFormula,
  ThemeMode,
  UnitSystem,
} from '@/domain/types';

/** First-run preferences. Everything here is changeable later in Settings. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const [step, setStep] = useState(0);

  const finish = async () => {
    await update({ onboardingCompletedAt: nowIso() });
    navigate('/', { replace: true });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <img src="/brand/app-icon-master.svg" alt="Lock’d" className="h-14 w-14 rounded-2xl" />
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">LOCKD</h1>
          <p className="text-sm text-ink-muted">Keep the receipt.</p>
        </div>
      </div>

      {step === 0 && (
        <Card>
          <h2 className="text-base font-semibold text-ink">Your record stays on this device</h2>
          <ul className="mt-2 space-y-2 text-sm text-ink-muted">
            <li>• Lock’d logs the work you did. Not a guess. Not a highlight reel.</li>
            <li>• Sessions live in a local database on this device.</li>
            <li>• Nothing is uploaded. The file stays here.</li>
            <li>• Works in airplane mode once installed.</li>
          </ul>
          <Button variant="primary" block className="mt-4" onClick={() => setStep(1)}>
            Set up preferences
          </Button>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-ink">Units</h2>
          <Segmented
            label="Unit system"
            value={settings.unitSystem}
            onChange={(value: UnitSystem) =>
              void update({ unitSystem: value, quickIncrementG: defaultQuickIncrementG(value) })
            }
            options={[
              { value: 'metric', label: 'Kilograms' },
              { value: 'imperial', label: 'Pounds' },
            ]}
          />
          <p className="mt-2 text-xs text-ink-subtle">
            Loads are stored in a single canonical unit, so switching later never changes your
            history — only how it is displayed.
          </p>

          <h2 className="mb-2 mt-5 text-base font-semibold text-ink">Intensity tracking</h2>
          <Segmented
            label="Intensity tracking"
            value={settings.intensityMode}
            onChange={(value: IntensityMode) => void update({ intensityMode: value })}
            options={[
              { value: 'rpe', label: 'RPE' },
              { value: 'rir', label: 'RIR' },
              { value: 'none', label: 'Neither' },
            ]}
          />

          <h2 className="mb-2 mt-5 text-base font-semibold text-ink">1RM formula</h2>
          <Segmented
            label="One rep max formula"
            value={settings.oneRepMaxFormula}
            onChange={(value: OneRepMaxFormula) => void update({ oneRepMaxFormula: value })}
            options={[
              { value: 'epley', label: 'Epley' },
              { value: 'brzycki', label: 'Brzycki' },
            ]}
          />

          <div className="mt-5 flex gap-2">
            <Button block onClick={() => setStep(0)}>
              Back
            </Button>
            <Button block variant="primary" onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-ink">Appearance</h2>
          <Segmented
            label="Theme mode"
            value={settings.themeMode}
            onChange={(value: ThemeMode) => void update({ themeMode: value })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />

          <p className="rf-label mt-4">Accent</p>
          <div className="grid grid-cols-2 gap-2">
            {ACCENT_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                aria-pressed={settings.accentTheme === theme.id}
                onClick={() => void update({ accentTheme: theme.id as AccentTheme })}
                className={
                  settings.accentTheme === theme.id
                    ? 'flex min-h-tap items-center gap-2 rounded border border-accent bg-accent/10 px-3 text-sm font-semibold text-ink'
                    : 'flex min-h-tap items-center gap-2 rounded border border-line bg-surface-raised px-3 text-sm text-ink-muted'
                }
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: theme.swatch }}
                />
                {theme.name}
                {settings.accentTheme === theme.id && (
                  <Icon icon={Icons.check} size={14} strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <Button block onClick={() => setStep(1)}>
              Back
            </Button>
            <Button block variant="primary" onClick={() => void finish()}>
              Start training
            </Button>
          </div>

          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-ink-subtle underline"
            onClick={() => void finish()}
          >
            Skip — I'll change these later
          </button>
        </Card>
      )}
    </main>
  );
}
