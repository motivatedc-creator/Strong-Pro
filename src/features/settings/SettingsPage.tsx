import { useState } from 'react';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import { Card, Field, NumberInput, PageHeader, Segmented, Toggle } from '@/components/ui';
import { APP_VERSION } from '@/db/dexieRepository';
import { DataSettings } from '@/features/data-transfer/DataSettings';
import { requestNotificationPermission } from '@/platform/feedback';
import { canSwitchAppIconAtRuntime, platform, setAppIcon } from '@/platform/capacitor';
import { ACCENT_THEMES } from '@/platform/theme';
import { formatWeight, defaultQuickIncrementG, toGrams } from '@/domain/units';
import type {
  AccentTheme,
  AppIcon,
  GoalLens,
  IntensityMode,
  OneRepMaxFormula,
  ThemeMode,
  UnitSystem,
  WeekStartDay,
} from '@/domain/types';
import { Icon, Icons } from '@/components/icons';
import { GoalLiftPicker } from '@/features/analytics/GoalLiftPicker';
import { GoalLensPicker } from '@/features/analytics/GoalLensPicker';
import { EquipmentSettings } from './EquipmentSettings';

const SECTIONS = ['training', 'timers', 'equipment', 'appearance', 'data', 'about'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_LABELS: Record<Section, string> = {
  training: 'Training',
  timers: 'Timers',
  equipment: 'Equipment',
  appearance: 'Appearance',
  data: 'Data',
  about: 'About',
};

const GOAL_LENS_LABELS: Record<GoalLens, string> = {
  build: 'Build',
  strength: 'Strength',
  maintain: 'Maintain',
};

const APP_ICONS: Array<{ id: AppIcon; name: string }> = [
  { id: 'default', name: 'Lock’d' },
  { id: 'ember', name: 'Ember' },
  { id: 'glacier', name: 'Glacier' },
  { id: 'moss', name: 'Moss' },
  { id: 'violet', name: 'Violet' },
];

export function SettingsPage() {
  const { settings, weightUnit, update } = useSettings();
  const [section, setSection] = useState<Section>('training');
  const [pickingGoalLifts, setPickingGoalLifts] = useState(false);
  const [pickingGoalLens, setPickingGoalLens] = useState(false);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Everything is stored locally and included in your backups."
      />

      <div className="rf-scroll-x mb-4" role="tablist" aria-label="Settings sections">
        {SECTIONS.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={section === value}
            onClick={() => setSection(value)}
            className={
              section === value
                ? 'min-h-tap shrink-0 rounded-full border border-accent bg-accent/15 px-4 text-sm font-semibold text-accent'
                : 'min-h-tap shrink-0 rounded-full border border-line bg-surface-raised px-4 text-sm font-medium text-ink-muted'
            }
          >
            {SECTION_LABELS[value]}
          </button>
        ))}
      </div>

      {section === 'training' && (
        <>
          <Card className="mb-3">
            <h2 className="mb-2 text-sm font-semibold text-ink">Units</h2>
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
              Loads are stored canonically, so switching units changes the display only — every
              historical number stays numerically identical.
            </p>

            <Field
              label={`Quick weight step (${weightUnit})`}
              hint="Used by the − and + buttons beside each set."
            >
              {({ id, describedBy }) => (
                <NumberInput
                  id={id}
                  aria-describedby={describedBy}
                  className="mt-2"
                  step="any"
                  min={0}
                  value={formatWeight(settings.quickIncrementG, weightUnit)}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value.replace(',', '.'));
                    if (Number.isFinite(value) && value > 0) {
                      void update({ quickIncrementG: toGrams(value, weightUnit) });
                    }
                  }}
                />
              )}
            </Field>
          </Card>

          <Card className="mb-3">
            <h2 className="mb-2 text-sm font-semibold text-ink">Intensity</h2>
            <Segmented
              label="Intensity tracking"
              value={settings.intensityMode}
              onChange={(value: IntensityMode) => void update({ intensityMode: value })}
              options={[
                { value: 'rpe', label: 'RPE' },
                { value: 'rir', label: 'RIR' },
                { value: 'none', label: 'Off' },
              ]}
            />
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Data Lab</h2>
            <Segmented
              label="Training week starts"
              value={settings.weekStartDay ?? 'monday'}
              onChange={(value: WeekStartDay) => void update({ weekStartDay: value })}
              options={[
                { value: 'saturday', label: 'Saturday' },
                { value: 'sunday', label: 'Sunday' },
                { value: 'monday', label: 'Monday' },
              ]}
            />
            <p className="mb-4 mt-2 text-xs text-ink-subtle">
              Used by Weekly Verdict and the “This week” Data Lab range. Older installs default to
              Monday until you choose otherwise.
            </p>
            <Segmented
              label="One rep max formula"
              value={settings.oneRepMaxFormula}
              onChange={(value: OneRepMaxFormula) => void update({ oneRepMaxFormula: value })}
              options={[
                { value: 'epley', label: 'Epley', hint: 'weight × (1 + reps / 30)' },
                { value: 'brzycki', label: 'Brzycki', hint: 'weight × 36 / (37 − reps)' },
              ]}
            />
            <Toggle
              label="Exclude warm-up sets"
              description="Warm-ups skew volume and 1RM estimates; excluded by default."
              checked={settings.excludeWarmupsFromAnalytics}
              onChange={(value) => void update({ excludeWarmupsFromAnalytics: value })}
            />
            <Field
              label="Secondary muscle credit"
              hint="Share of a set's volume attributed to each secondary muscle (0–1). Attributed volume is not tonnage."
            >
              {({ id, describedBy }) => (
                <NumberInput
                  id={id}
                  aria-describedby={describedBy}
                  step="0.05"
                  min={0}
                  max={1}
                  value={settings.secondaryMuscleCredit}
                  onChange={(event) => {
                    const value = Number.parseFloat(event.target.value);
                    if (Number.isFinite(value)) {
                      void update({ secondaryMuscleCredit: Math.min(1, Math.max(0, value)) });
                    }
                  }}
                />
              )}
            </Field>

            <div className="mt-4 border-t border-line pt-4">
              <p className="rf-label">Goal lifts</p>
              <p className="mb-2 mt-1 text-xs text-ink-subtle">
                Up to 3 lifts Weekly Verdict and stall flags track. Leave none set and Lock’d uses
                your most-trained lifts instead, labelled as a guess on the Data Lab card.
              </p>
              <button
                type="button"
                className="min-h-tap text-sm font-semibold text-accent"
                onClick={() => setPickingGoalLifts(true)}
              >
                {settings.goalLiftIds && settings.goalLiftIds.length > 0
                  ? `${settings.goalLiftIds.length} lift${settings.goalLiftIds.length === 1 ? '' : 's'} set — change`
                  : 'Your top lifts — set your own'}
              </button>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <p className="rf-label">Goal lens</p>
              <p className="mb-2 mt-1 text-xs text-ink-subtle">
                Changes how the Weekly Verdict describes your week. It never changes the numbers
                themselves.
              </p>
              <button
                type="button"
                className="min-h-tap text-sm font-semibold text-accent"
                onClick={() => setPickingGoalLens(true)}
              >
                {`Lens: ${GOAL_LENS_LABELS[settings.goalLens ?? 'build']} — change`}
              </button>
            </div>
          </Card>
        </>
      )}

      {section === 'timers' && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">Rest timer</h2>
          <Field label="Default rest (seconds)" hint="Used for exercises added outside a routine.">
            {({ id, describedBy }) => (
              <NumberInput
                id={id}
                aria-describedby={describedBy}
                min={0}
                step={15}
                inputMode="numeric"
                value={settings.defaultRestSeconds}
                onChange={(event) => {
                  const value = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
                  void update({ defaultRestSeconds: value });
                }}
              />
            )}
          </Field>
          <Toggle
            label="Start automatically"
            description="Begins the rest timer as soon as you tick a set off."
            checked={settings.restTimerAutoStart}
            onChange={(value) => void update({ restTimerAutoStart: value })}
          />
          <Toggle
            label="Sound"
            description="A short chime when rest is up."
            checked={settings.restTimerSound}
            onChange={(value) => void update({ restTimerSound: value })}
          />
          <Toggle
            label="Vibration"
            description="Where the device supports it (not iOS Safari)."
            checked={settings.restTimerVibrate}
            onChange={(value) => void update({ restTimerVibrate: value })}
          />
          <Toggle
            label="Notification"
            description="Best effort. On the web this only fires while Lock’d is open; native builds schedule a real local notification."
            checked={settings.restTimerNotification}
            onChange={async (value) => {
              if (value) {
                const granted = await requestNotificationPermission();
                if (!granted) {
                  toast.warning('Your browser denied notification permission.');
                  return;
                }
              }
              void update({ restTimerNotification: value });
            }}
          />
          <p className="mt-2 text-xs text-ink-subtle">
            The timer is stored as an absolute end time, so it survives a reload, a locked screen or
            the app being killed — it never relies on a background loop.
          </p>
        </Card>
      )}

      {section === 'equipment' && <EquipmentSettings />}

      {section === 'appearance' && (
        <>
          <Card className="mb-3">
            <h2 className="mb-2 text-sm font-semibold text-ink">Theme</h2>
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
                      : 'flex min-h-tap items-center gap-2 rounded border border-line bg-surface-raised px-3 text-sm font-medium text-ink-muted'
                  }
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: theme.swatch }}
                  />
                  <span className="min-w-0 truncate">{theme.name}</span>
                  {settings.accentTheme === theme.id && (
                    <Icon icon={Icons.check} size={14} strokeWidth={2.5} />
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">App icon</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {APP_ICONS.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  aria-pressed={settings.appIcon === icon.id}
                  onClick={async () => {
                    await update({ appIcon: icon.id });
                    const result = await setAppIcon(icon.id);
                    if (result.ok) toast.success('Home-screen icon changed.');
                    else if (result.reason === 'unsupported-platform') {
                      toast.info(
                        platform() === 'web'
                          ? 'Saved. Installed PWA icons come from the manifest — reinstall to change the home-screen icon.'
                          : 'Saved. This platform has no runtime icon switching.',
                      );
                    } else {
                      toast.warning('Saved, but the native icon could not be switched.');
                    }
                  }}
                  className={
                    settings.appIcon === icon.id
                      ? 'flex flex-col items-center gap-1 rounded border border-accent bg-accent/10 p-2'
                      : 'flex flex-col items-center gap-1 rounded border border-line bg-surface-raised p-2'
                  }
                >
                  <img
                    src={`/icons/icon-${icon.id}.svg`}
                    alt=""
                    aria-hidden="true"
                    className="h-12 w-12 rounded-lg"
                  />
                  <span className="text-[11px] text-ink-muted">{icon.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              {canSwitchAppIconAtRuntime()
                ? 'Your choice is applied to the iOS home-screen icon immediately.'
                : 'Installed as a web app, the home-screen icon is controlled by the platform through the manifest and cannot be changed at runtime — reinstall to pick up a new one. In a Capacitor iOS build, Lock’d switches the icon natively.'}
            </p>
          </Card>
        </>
      )}

      {section === 'data' && <DataSettings />}

      {section === 'about' && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-ink">About Lock’d</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Version</dt>
              <dd className="text-ink tabular-nums">{APP_VERSION}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Platform</dt>
              <dd className="text-ink">{platform()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Storage</dt>
              <dd className="text-ink">IndexedDB, on this device</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            Lock’d is free and subscription-free: no accounts, no ads, no analytics, no telemetry,
            no server. Your training data never leaves this device unless you export it yourself.
            Lock’d is an independent, original product and is not affiliated with any other fitness
            app.
          </p>
        </Card>
      )}

      <GoalLiftPicker
        open={pickingGoalLifts}
        onClose={() => setPickingGoalLifts(false)}
        goalLiftIds={settings.goalLiftIds}
        onChange={(goalLiftIds) => void update({ goalLiftIds })}
      />

      <GoalLensPicker
        open={pickingGoalLens}
        onClose={() => setPickingGoalLens(false)}
        goalLens={settings.goalLens}
        onGoalLensChange={(goalLens) => void update({ goalLens })}
      />

      <div className="h-8" aria-hidden="true" />
    </>
  );
}
