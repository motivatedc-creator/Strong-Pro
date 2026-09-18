import { uuid } from '@/domain/ids';
import { localDateOf, nowIso, tzOffsetMinutes } from '@/domain/time';
import type {
  UUID,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';
import type { StartWorkoutInput, WorkoutQuery } from './repository';
import { DexieRepositoryTemplates } from './dexieRepository.templates';
import {
  ActiveWorkoutExistsError,
  defaultWorkoutName,
  snapshotExercise,
} from './dexieRepository.helpers';

export class DexieRepositoryWorkouts1 extends DexieRepositoryTemplates {
  // ---------------------------------------------------------------- workouts

  async getActiveWorkout(): Promise<WorkoutDetail | undefined> {
    const active = await this.db.workouts.where('status').equals('active').first();
    if (!active) return undefined;
    return this.getWorkoutDetail(active.id);
  }

  async startWorkout(input: StartWorkoutInput): Promise<WorkoutDetail> {
    const now = nowIso();
    const date = new Date();
    const workoutId = uuid();

    await this.db.transaction(
      'rw',
      [
        this.db.workouts,
        this.db.workoutExercises,
        this.db.workoutSets,
        this.db.templates,
        this.db.templateExercises,
        this.db.exercises,
      ],
      async () => {
        // Guard against a double tap creating two active sessions.
        const existing = await this.db.workouts.where('status').equals('active').first();
        if (existing) throw new ActiveWorkoutExistsError(existing.id);

        let name = input.name?.trim() || defaultWorkoutName(date);
        const template = input.templateId
          ? await this.db.templates.get(input.templateId)
          : undefined;
        if (template && !input.name) name = template.name;

        const workout: Workout = {
          id: workoutId,
          templateId: template?.id,
          name,
          status: 'active',
          startedAt: now,
          localDate: localDateOf(date),
          tzOffsetMinutes: tzOffsetMinutes(date),
          pausedSeconds: 0,
          notes: template?.notes,
          createdAt: now,
          updatedAt: now,
        };
        await this.db.workouts.put(workout);

        if (template) {
          const templateExercises = (
            await this.db.templateExercises.where('templateId').equals(template.id).toArray()
          ).sort((a, b) => a.order - b.order);
          const exercises = await this.db.exercises.bulkGet(
            templateExercises.map((t) => t.exerciseId),
          );

          const workoutExercises: WorkoutExercise[] = [];
          const sets: WorkoutSet[] = [];

          templateExercises.forEach((templateExercise, index) => {
            const exercise = exercises[index];
            if (!exercise) return;
            const workoutExercise = snapshotExercise(workoutId, exercise, workoutExercises.length, {
              restSeconds: templateExercise.restSeconds,
              notes: templateExercise.notes,
              supersetGroup: templateExercise.supersetGroup,
            });
            workoutExercises.push(workoutExercise);
            for (let i = 0; i < Math.max(1, templateExercise.targetSets); i += 1) {
              sets.push({
                id: uuid(),
                workoutId,
                workoutExerciseId: workoutExercise.id,
                order: i,
                setType: templateExercise.defaultSetType ?? 'working',
                reps: templateExercise.targetRepMin,
                rpe: templateExercise.targetRpe,
                rir: templateExercise.targetRir,
                isCompleted: false,
              });
            }
          });

          if (workoutExercises.length > 0) await this.db.workoutExercises.bulkPut(workoutExercises);
          if (sets.length > 0) await this.db.workoutSets.bulkPut(sets);
        }
      },
    );

    const detail = await this.getWorkoutDetail(workoutId);
    if (!detail) throw new Error('Failed to create workout');
    return detail;
  }

  async getWorkoutDetail(id: UUID): Promise<WorkoutDetail | undefined> {
    const workout = await this.db.workouts.get(id);
    if (!workout) return undefined;
    const exercises = (await this.db.workoutExercises.where('workoutId').equals(id).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    const sets = await this.db.workoutSets.where('workoutId').equals(id).toArray();
    return {
      workout,
      exercises: exercises.map((exercise) => ({
        exercise,
        sets: sets
          .filter((set) => set.workoutExerciseId === exercise.id)
          .sort((a, b) => a.order - b.order),
      })),
    };
  }

  async listWorkouts(query: WorkoutQuery = {}): Promise<Workout[]> {
    const rows = await this.queryWorkouts(query);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async countWorkouts(query: WorkoutQuery = {}): Promise<number> {
    return (await this.queryWorkouts(query)).length;
  }

  private async queryWorkouts(query: WorkoutQuery): Promise<Workout[]> {
    let rows = await this.db.workouts.where('status').equals('completed').toArray();

    if (query.from) rows = rows.filter((workout) => workout.startedAt >= query.from!);
    if (query.to) rows = rows.filter((workout) => workout.startedAt <= query.to!);

    if (query.exerciseId) {
      const matching = new Set(
        (await this.db.workoutExercises.where('exerciseId').equals(query.exerciseId).toArray()).map(
          (row) => row.workoutId,
        ),
      );
      rows = rows.filter((workout) => matching.has(workout.id));
    }

    const search = query.search?.trim().toLowerCase();
    if (search) {
      const exerciseMatches = await this.db.workoutExercises.toArray();
      const workoutIds = new Set(
        exerciseMatches
          .filter((row) => row.exerciseNameSnapshot.toLowerCase().includes(search))
          .map((row) => row.workoutId),
      );
      rows = rows.filter(
        (workout) =>
          workout.name.toLowerCase().includes(search) ||
          (workout.notes ?? '').toLowerCase().includes(search) ||
          workoutIds.has(workout.id),
      );
    }

    return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async updateWorkout(id: UUID, patch: Partial<Workout>): Promise<void> {
    await this.db.workouts.update(id, { ...patch, updatedAt: nowIso() });
  }

  async completeWorkout(id: UUID): Promise<void> {
    const now = nowIso();
    await this.db.transaction(
      'rw',
      [this.db.workouts, this.db.workoutSets, this.db.timers],
      async () => {
        const workout = await this.db.workouts.get(id);
        // Idempotent: a duplicate tap on "Finish" must not produce a second completion.
        if (!workout || workout.status === 'completed') return;
        // Incomplete sets are dropped rather than silently counted as performed work.
        const sets = await this.db.workoutSets.where('workoutId').equals(id).toArray();
        const incomplete = sets.filter((set) => !set.isCompleted).map((set) => set.id);
        if (incomplete.length > 0) await this.db.workoutSets.bulkDelete(incomplete);
        await this.db.workouts.update(id, { status: 'completed', endedAt: now, updatedAt: now });
        await this.db.timers.delete('rest-timer');
      },
    );
  }

  async discardWorkout(id: UUID): Promise<void> {
    await this.deleteWorkout(id);
    await this.db.timers.delete('rest-timer');
  }

  async deleteWorkout(id: UUID): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.workouts, this.db.workoutExercises, this.db.workoutSets],
      async () => {
        await this.db.workoutSets.where('workoutId').equals(id).delete();
        await this.db.workoutExercises.where('workoutId').equals(id).delete();
        await this.db.workouts.delete(id);
      },
    );
  }

}
