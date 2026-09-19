import { describe, expect, it } from 'vitest';
import { seedExercises, slugify } from './seedData';
import { STARTER_CATEGORIES, STARTER_TEMPLATES, buildStarterTemplate } from './starterTemplates';

describe('starter routine presets', () => {
  const seedIds = new Set(seedExercises('now').map((exercise) => exercise.id));

  it('has no empty presets', () => {
    for (const preset of STARTER_TEMPLATES) {
      expect(preset.exercises.length, `${preset.name} has no exercises`).toBeGreaterThan(0);
    }
  });

  it('resolves every exercise name to a real seed exercise', () => {
    for (const preset of STARTER_TEMPLATES) {
      for (const entry of preset.exercises) {
        const id = `seed-${slugify(entry.exerciseName)}`;
        expect(seedIds.has(id), `"${entry.exerciseName}" in ${preset.name} has no seed match`).toBe(
          true,
        );
      }
    }
  });

  it('has a unique id per preset', () => {
    const ids = STARTER_TEMPLATES.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses categories the sheet's heading order covers", () => {
    for (const preset of STARTER_TEMPLATES) {
      expect(STARTER_CATEGORIES).toContain(preset.category);
    }
  });

  it('builds a valid template + exercise rows for every preset', () => {
    STARTER_TEMPLATES.forEach((preset, index) => {
      const { template, exercises } = buildStarterTemplate(preset, index);
      expect(template.name).toBe(preset.name);
      expect(exercises).toHaveLength(preset.exercises.length);
      expect(exercises.every((entry) => entry.templateId === template.id)).toBe(true);
    });
  });
});
