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
  Spinner,
  Toggle,
  buttonClasses,
} from '@/components/ui';
import { ActiveWorkoutExistsError } from '@/db/dexieRepository';
import type { Template } from '@/domain/types';

/** Template list: create, reorder, duplicate, archive, delete — with no limit on how many. */
export function TemplatesPage() {
  const navigate = useNavigate();
  const repository = useRepository();
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);

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
    toast.info('Template deleted. Workouts started from it are untouched.');
    reload();
  });

  const templates = data?.templates ?? [];
  const activeTemplates = templates.filter((template) => !template.isArchived);
  const archivedTemplates = templates.filter((template) => template.isArchived);
  const hasActiveWorkout = !!data?.active;

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Reusable session plans. Create as many as you like."
        actions={
          <Link to="/templates/new" className={buttonClasses('primary')}>
            New template
          </Link>
        }
      />

      {loading && !data && <Spinner label="Loading templates" />}

      {!loading && activeTemplates.length === 0 && archivedTemplates.length === 0 && (
        <EmptyState
          title="No templates yet"
          description="A template holds your exercises, target sets, rep ranges and rest times so a session starts in one tap."
          icon="▤"
          action={
            <Link to="/templates/new" className={buttonClasses('primary')}>
              Create your first template
            </Link>
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
                  <span aria-hidden="true">↑</span>
                </IconButton>
                <IconButton
                  label={`Move ${template.name} down`}
                  disabled={index === activeTemplates.length - 1}
                  onClick={() => void move(template.id, 1)}
                >
                  <span aria-hidden="true">↓</span>
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
            description="Archived templates stay out of your way but keep their contents."
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

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        confirmLabel="Delete template"
        body={
          <p>
            The template and its planned exercises are removed. Workouts you already logged from it
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
