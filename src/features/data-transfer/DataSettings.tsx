import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import { Button, Card, ConfirmDialog, Segmented, Sheet, TextInput } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import type { BackupPayload } from '@/db/repository';
import { formatDateTime } from '@/domain/time';
import {
  MAX_BACKUP_BYTES,
  pruneOrphans,
  validateBackup,
  type BackupValidation,
} from './backupSchema';
import { backupFileName, backupToJson, buildCsvBundle, downloadFile } from './exporters';

/**
 * Export, restore and delete — the whole data-portability surface.
 *
 * Restores validate the file against the backup schema and show a human-readable preview
 * before anything is written, and a replace always offers to back up what is there first.
 */
export function DataSettings() {
  const repository = useRepository();
  const { settings } = useSettings();
  const fileInput = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<BackupValidation | null>(null);
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearText, setClearText] = useState('');

  const { data: jobs } = useRepositoryData((repo) => repo.listImportJobs(), []);

  const [exportJson, exportingJson] = useWrite(async () => {
    const backup = await repository.exportAll();
    downloadFile(backupFileName(), backupToJson(backup), 'application/json');
    toast.success('Backup downloaded.');
  });

  const [exportCsv, exportingCsv] = useWrite(async () => {
    const backup = await repository.exportAll();
    for (const file of buildCsvBundle(backup, settings)) {
      downloadFile(file.fileName, file.content, 'text/csv');
    }
    toast.success('CSV files downloaded.');
  });

  const readFile = async (file: File) => {
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error('That file is too large to be a Lock’d backup.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error('That file is not valid JSON.');
      return;
    }
    const result = validateBackup(parsed);
    setValidation(result);
    setPayload(result.payload ? pruneOrphans(result.payload) : null);
  };

  const [restore, restoring] = useWrite(async () => {
    if (!payload) return;
    if (mode === 'replace') {
      await repository.replaceAll(payload);
      toast.success('Backup restored. Existing data was replaced.');
    } else {
      const result = await repository.mergeBackup(payload);
      toast.success(
        `Merged: ${result.workoutsAdded} workouts added, ${result.workoutsSkipped} already present.`,
      );
    }
    setValidation(null);
    setPayload(null);
  });

  const [clearAll] = useWrite(async () => {
    await repository.clearAllUserData();
    toast.success('All local data deleted.');
    setConfirmClear(false);
    setClearText('');
  });

  return (
    <>
      <Card className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Export</h3>
        <p className="mt-1 text-xs text-ink-muted">
          A JSON backup contains everything: workouts, sets, exercises, routines, measurements,
          equipment and settings. CSV export is a clean, spreadsheet-safe copy of the same data.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" disabled={exportingJson} onClick={() => void exportJson()}>
            Download JSON backup
          </Button>
          <Button disabled={exportingCsv} onClick={() => void exportCsv()}>
            Download CSV files
          </Button>
        </div>
      </Card>

      <Card className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Restore from backup</h3>
        <p className="mt-1 text-xs text-ink-muted">
          The file is validated and previewed before anything is written. Nothing leaves this
          device.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="mt-3 block w-full text-sm text-ink-muted file:mr-3 file:min-h-tap file:rounded file:border file:border-line file:bg-surface-raised file:px-4 file:text-sm file:font-semibold file:text-ink"
          aria-label="Choose a Lock’d JSON backup"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
      </Card>

      <Card className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Import from Strong</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Bring in the CSV you exported from the Strong app: map the columns, preview what will be
          written, and import in one transaction.
        </p>
        <Link to="/settings/import" className="mt-3 inline-block text-sm font-semibold text-accent">
          Open the import wizard →
        </Link>
        {(jobs?.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-ink-subtle">
            {jobs?.slice(0, 3).map((job) => (
              <li key={job.id}>
                {job.fileName} · {formatDateTime(job.startedAt)} · {job.workoutsImported} workouts,{' '}
                {job.setsImported} sets
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-danger/40">
        <h3 className="text-sm font-semibold text-danger">Delete all local data</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Erases every workout, routine, custom exercise and measurement stored in this browser,
          then re-seeds the starter exercise library. Export a backup first if you might want any of
          it back.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setConfirmClear(true)}>
          Delete everything
        </Button>
      </Card>

      <Sheet
        open={!!validation}
        onClose={() => {
          setValidation(null);
          setPayload(null);
          if (fileInput.current) fileInput.current.value = '';
        }}
        title="Restore preview"
        size="lg"
        footer={
          validation?.ok ? (
            <Button
              block
              variant={mode === 'replace' ? 'danger' : 'primary'}
              disabled={restoring}
              onClick={() => (mode === 'replace' ? setConfirmReplace(true) : void restore())}
            >
              {mode === 'replace' ? 'Replace all data' : 'Merge into my data'}
            </Button>
          ) : undefined
        }
      >
        {validation && !validation.ok && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-danger">
              <Icon icon={Icons.warning} size={14} />
              This file is not a valid Lock’d backup, so nothing was changed.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-xs text-ink-muted">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {validation?.ok && validation.summary && (
          <div>
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">Exported</dt>
                <dd className="text-ink">{formatDateTime(validation.summary.exportedAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">App version</dt>
                <dd className="text-ink">{validation.summary.appVersion}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Workouts</dt>
                <dd className="text-ink tabular-nums">{validation.summary.workouts}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Sets</dt>
                <dd className="text-ink tabular-nums">{validation.summary.sets}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Exercises</dt>
                <dd className="text-ink tabular-nums">{validation.summary.exercises}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">Measurements</dt>
                <dd className="text-ink tabular-nums">{validation.summary.measurements}</dd>
              </div>
            </dl>

            {validation.errors.length > 0 && (
              <ul className="mb-4 list-disc space-y-1 rounded border border-warning/50 bg-warning/10 p-3 pl-6 text-xs text-ink-muted">
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}

            <span className="rf-label">Restore mode</span>
            <Segmented
              label="Restore mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: 'Merge' },
                { value: 'replace', label: 'Replace' },
              ]}
            />
            <p className="mt-2 text-xs text-ink-subtle">
              {mode === 'merge'
                ? 'Adds anything missing and skips workouts you already have. Nothing is deleted.'
                : 'Deletes everything currently stored and replaces it with this backup.'}
            </p>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmReplace}
        title="Replace all data with this backup?"
        confirmLabel="Back up, then replace"
        body={
          <p>
            Every workout, routine, exercise and measurement currently on this device is deleted and
            replaced by the contents of this file. Lock’d will download a backup of your current
            data first so the step is reversible.
          </p>
        }
        onCancel={() => setConfirmReplace(false)}
        onConfirm={async () => {
          setConfirmReplace(false);
          const safety = await repository.exportAll();
          downloadFile(`pre-restore-${backupFileName()}`, backupToJson(safety), 'application/json');
          void restore();
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Delete all local data?"
        confirmLabel="Delete everything"
        body={
          <div>
            <p>
              This erases every workout, set, routine, custom exercise and measurement stored in
              this browser. It cannot be undone, and Lock’d keeps no copy anywhere else.
            </p>
            <label className="rf-label mt-3" htmlFor="confirm-delete">
              Type DELETE to confirm
            </label>
            <TextInput
              id="confirm-delete"
              value={clearText}
              autoComplete="off"
              onChange={(event) => setClearText(event.target.value)}
            />
            {clearText !== 'DELETE' && (
              <p className="mt-1 text-xs text-ink-subtle">Confirmation text does not match yet.</p>
            )}
          </div>
        }
        onCancel={() => {
          setConfirmClear(false);
          setClearText('');
        }}
        onConfirm={() => {
          if (clearText !== 'DELETE') {
            toast.warning('Type DELETE to confirm.');
            return;
          }
          void clearAll();
        }}
      />
    </>
  );
}
