import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  PageHeader,
  Sheet,
  Spinner,
  Toggle,
  buttonClasses,
} from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { ActiveWorkoutExistsError } from '@/db/dexieRepository';
import { STARTER_CATEGORIES, STARTER_TEMPLATES, buildStarterTemplate } from '@/db/starterTemplates';
import type { Template } from '@/domain/types';

/** Template list: create, reorder, duplicate, archive, delete — with no limit on how many. */
export function TemplatesPage() {
  const navigate = useNavigate();
  const repository = useRepository();
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [browsingStarters, setBrowsingStarters] = useState(false);

  const { data, loading, reload } = useRepositoryData(
    async (repo) => ({
      templates: await repo.listTemplates({ includeArchived: true }),
      active: await repo.getActiveWorkout(),
      counts: await (async () => {
        const all = await repo.listTemplates({ includeArchived: true });
        const entries = await Promise.all(
          all.map(async (template) => {
            const detail = await repo.getTemplateDetail(template.id);
            return [template.id, detail?.exercises.length ?? 0] as const;
          }),
        );
        return Object.fromEntries(entries) as Record<string, number>;
      })(),
    }),
    [],
  );

  const [start, starting] = useWrite(async (templateId: string) => {
    try {
      await repository.startWorkout({ templateId });
      navigate('/workout');
    } catch (error) {
      if (error instanceof ActiveWorkoutExistsError) {
        toast.warning('Finish or discard your current workout first.');
        navigate('/workout');
        return;
      }
      throw error;
    }
  });

  const [duplicate] = useWrite(async (templateId: string) => {
    const copy = await repository.duplicateTemplate(templateId);
    if (copy) toast.success(`Duplicated as "${copy.name}".`);
    reload();
  });

  const [setArchived] = useWrite(async (templateId: string, archived: boolean) => {
    await repository.setTemplateArchived(templateId, archived);
    reload();
  });

  const [move] = useWrite(async (templateId: string, direction: -1 | 1) => {
    const visible = (data?.templates ?? []).filter((template) => !template.isArchived);
    const ids = visible.map((template) => template.id);
    const index = ids.indexOf(templateId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await repository.reorderTemplates(ids);
    reload();
  });

  const [remove] = useWrite(async (templateId: string) => {
    await repository.deleteTemplate(templateId);
    toast.info('Routine deleted. Workouts started from it are untouched.');
    reload();
  });

  const [addStarter] = useWrite(async (presetId: string) => {
    const preset = STARTER_TEMPLATES.find((entry) => entry.id === presetId);
    if (!preset) return;
    const order = (data?.templates ?? []).length;
    const { template, exercises } = buildStarterTemplate(preset, order);
    await repository.saveTemplate(template, exercises);
    toast.success(`"${preset.name}" added to your routines.`);
    reload();
  });

  const templates = data?.templates ?? [];
  const activeTemplates = templates.filter((template) => !template.isArchived);
  const archivedTemplates = templates.filter((template) => template.isArchived);
  const hasActiveWorkout = !!data?.active;

  return (
    <>
      <PageHeader
        title="Routines"
        subtitle="Reusable session plans. Create as many as you like."
        actions={
          <>
            <Button onClick={() => setBrowsingStarters(true)}>Preset routines</Button>
            <Link to="/templates/new" className={buttonClasses('primary')}>
              New routine
            </Link>
          </>
        }
      />

      {loading && !data && <Spinner label="Loading routines" />}

      {!loading && activeTemplates.length === 0 && archivedTemplates.length === 0 && (
        <EmptyState
          title="No custom routines yet"
          description="A routine holds your exercises, target sets, rep ranges and rest times so a session starts in one tap. Build your own, or add one of ours to get moving today."
          icon={<Icon icon={Icons.routines} size={22} />}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setBrowsingStarters(true)}>
                Browse preset routines
              </Button>
              <Link to="/templates/new" className={buttonClasses('secondary')}>
                Create from scratch
              </Link>
            </div>
          }
        />
      )}

      <ul className="space-y-2">
        {activeTemplates.map((template, index) => (
          <li key={template.id}>
            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/templates/${template.id}`} className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-ink">{template.name}</h2>
                  <p className="text-xs text-ink-subtle">
                    {data?.counts[template.id] ?? 0} exercise
                    {(data?.counts[template.id] ?? 0) === 1 ? '' : 's'}
                    {template.notes ? ` · ${template.notes}` : ''}
                  </p>
                </Link>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={starting || hasActiveWorkout}
                  onClick={() => void start(template.id)}
                >
                  Start
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1">
                <IconButton
                  label={`Move ${template.name} up`}
                  disabled={index === 0}
                  onClick={() => void move(template.id, -1)}
                >
                  <Icon icon={Icons.chevronUp} size={16} />
                </IconButton>
                <IconButton
                  label={`Move ${template.name} down`}
                  disabled={index === activeTemplates.length - 1}
                  onClick={() => void move(template.id, 1)}
                >
                  <Icon icon={Icons.chevronDown} size={16} />
                </IconButton>
                <Button size="sm" variant="ghost" onClick={() => void duplicate(template.id)}>
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void setArchived(template.id, true)}
                >
                  Archive
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(template)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {archivedTemplates.length > 0 && (
        <div className="mt-6">
          <Toggle
            label={`Show archived (${archivedTemplates.length})`}
            description="Archived routines stay out of your way but keep their contents."
            checked={showArchived}
            onChange={setShowArchived}
          />
          {showArchived && (
            <ul className="mt-2 space-y-2">
              {archivedTemplates.map((template) => (
                <li key={template.id}>
                  <Card className="flex items-center justify-between gap-2 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {template.name}
                      </span>
                      <Chip>Archived</Chip>
                    </span>
                    <span className="flex gap-1">
                      <Button size="sm" onClick={() => void setArchived(template.id, false)}>
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => setConfirmDelete(template)}
                      >
                        Delete
                      </Button>
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Sheet
        open={browsingStarters}
        onClose={() => setBrowsingStarters(false)}
        title="Preset routines"
        description="Add one in a tap, then edit it however you like — nothing here is fixed."
      >
        {STARTER_CATEGORIES.map((category) => {
          const presets = STARTER_TEMPLATES.filter((preset) => preset.category === category);
          if (presets.length === 0) return null;
          return (
            <div key={category} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {category}
              </h3>
              <ul className="space-y-2">
                {presets.map((preset) => (
                  <li key={preset.id}>
                    <Card className="p-3">
                      <h4 className="text-sm font-semibold text-ink">{preset.name}</h4>
                      <p className="mt-0.5 text-xs text-ink-muted">{preset.description}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {preset.exercises.map((entry) => entry.exerciseName).join(' · ')}
                      </p>
                      <Button
                        size="sm"
                        variant="primary"
                        className="mt-2"
                        onClick={() => void addStarter(preset.id)}
                      >
                        Add to my routines
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Sheet>

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        confirmLabel="Delete routine"
        body={
          <p>
            The routine and its planned exercises are removed. Workouts you already logged from it
            stay in your history, untouched. This cannot be undone.
          </p>
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void remove(target.id);
        }}
      />
    </>
  );
}
