import { uuid } from '@/domain/ids';
import { nowIso } from '@/domain/time';
import type { Template, TemplateExercise, UUID } from '@/domain/types';
import type { TemplateDetail } from './repository';
import { DexieRepositoryCore } from './dexieRepository.core';

export class DexieRepositoryTemplates extends DexieRepositoryCore {
  // --------------------------------------------------------------- templates

  async listTemplates(options: { includeArchived?: boolean } = {}): Promise<Template[]> {
    const all = await this.db.templates.toArray();
    const filtered = options.includeArchived ? all : all.filter((template) => !template.isArchived);
    return filtered.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async getTemplateDetail(id: UUID): Promise<TemplateDetail | undefined> {
    const template = await this.db.templates.get(id);
    if (!template) return undefined;
    const templateExercises = (
      await this.db.templateExercises.where('templateId').equals(id).toArray()
    ).sort((a, b) => a.order - b.order);
    const exercises = await this.db.exercises.bulkGet(templateExercises.map((t) => t.exerciseId));
    return {
      template,
      exercises: templateExercises.map((templateExercise, index) => ({
        templateExercise,
        exercise: exercises[index] ?? undefined,
      })),
    };
  }

  async createTemplate(name: string, notes?: string): Promise<Template> {
    const now = nowIso();
    const count = await this.db.templates.count();
    const template: Template = {
      id: uuid(),
      name,
      notes,
      order: count,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.templates.put(template);
    return template;
  }

  async saveTemplate(template: Template, exercises: TemplateExercise[]): Promise<void> {
    await this.db.transaction('rw', [this.db.templates, this.db.templateExercises], async () => {
      await this.db.templates.put({ ...template, updatedAt: nowIso() });
      await this.db.templateExercises.where('templateId').equals(template.id).delete();
      if (exercises.length > 0) {
        await this.db.templateExercises.bulkPut(
          exercises.map((exercise, index) => ({
            ...exercise,
            templateId: template.id,
            order: index,
          })),
        );
      }
    });
  }

  async duplicateTemplate(id: UUID): Promise<Template | undefined> {
    const detail = await this.getTemplateDetail(id);
    if (!detail) return undefined;
    const now = nowIso();
    const count = await this.db.templates.count();
    const copy: Template = {
      ...detail.template,
      id: uuid(),
      name: `${detail.template.name} (copy)`,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveTemplate(
      copy,
      detail.exercises.map(({ templateExercise }) => ({
        ...templateExercise,
        id: uuid(),
        templateId: copy.id,
      })),
    );
    return copy;
  }

  async setTemplateArchived(id: UUID, archived: boolean): Promise<void> {
    await this.db.templates.update(id, { isArchived: archived, updatedAt: nowIso() });
  }

  async deleteTemplate(id: UUID): Promise<void> {
    // Completed workouts keep their templateId as a historical reference; deleting the
    // template never deletes the workouts that came from it.
    await this.db.transaction('rw', [this.db.templates, this.db.templateExercises], async () => {
      await this.db.templateExercises.where('templateId').equals(id).delete();
      await this.db.templates.delete(id);
    });
  }

  async reorderTemplates(orderedIds: UUID[]): Promise<void> {
    await this.db.transaction('rw', this.db.templates, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          this.db.templates.update(id, { order: index, updatedAt: nowIso() }),
        ),
      );
    });
  }

}
