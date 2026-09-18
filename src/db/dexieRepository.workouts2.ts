import { uuid } from '@/domain/ids';
import { nowIso } from '@/domain/time';
import type {
  UUID,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';
import type { SetWithContext } from '@/domain/records';
import type { NewSetInput } from './repository';
import { DexieRepositoryWorkouts1 } from './dexieRepository.workouts1';
import { snapshotExercise } from './dexieRepository.helpers';

export class DexieRepositoryWorkouts2 extends DexieRepositoryWorkouts1 {
  async addExerciseToWorkout(
    workoutId: UUID,
    exerciseId: UUID,
    options: { supersetGroup?: string } = {},
  ): Promise<WorkoutExercise> {
    const exercise = await this.db.exercises.get(exerciseId);
    if (!exercise) throw new Error(`Exercise ${exerciseId} not found`);
    const settings = await this.getSettings();
    const count = await this.db.workoutExercises.where('workoutId').equals(workoutId).count();
    const workoutExercise = snapshotExercise(workoutId, exercise, count, {
      restSeconds: settings.defaultRestSeconds,
      supersetGroup: options.supersetGroup,
    });
    await this.db.workoutExercises.put(workoutExercise);
    await this.updateWorkout(workoutId, {});
    return workoutExercise;
  }

  async removeWorkoutExercise(workoutExerciseId: UUID): Promise<void> {
    await this.db.transaction('rw', [this.db.workoutExercises, this.db.workoutSets], async () => {
      const row = await this.db.workoutExercises.get(workoutExerciseId);
      if (!row) return;
      await this.db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).delete();
      await this.db.workoutExercises.delete(workoutExerciseId);
      const remaining = (
        await this.db.workoutExercises.where('workoutId').equals(row.workoutId).toArray()
      ).sort((a, b) => a.order - b.order);
      await Promise.all(
        remaining.map((exercise, index) =>
          this.db.workoutExercises.update(exercise.id, { order: index }),
        ),
      );
    });
  }

  async replaceWorkoutExercise(workoutExerciseId: UUID, newExerciseId: UUID): Promise<void> {
    const [row, exercise] = await Promise.all([
      this.db.workoutExercises.get(workoutExerciseId),
      this.db.exercises.get(newExerciseId),
    ]);
    if (!row || !exercise) return;
    await this.db.workoutExercises.update(workoutExerciseId, {
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      primaryMuscleGroupSnapshot: exercise.primaryMuscleGroup,
      secondaryMuscleGroupsSnapshot: exercise.secondaryMuscleGroups,
      equipmentSnapshot: exercise.equipment,
      trackingTypeSnapshot: exercise.trackingType,
    });
  }

  async reorderWorkoutExercises(workoutId: UUID, orderedIds: UUID[]): Promise<void> {
    await this.db.transaction('rw', this.db.workoutExercises, async () => {
      await Promise.all(
        orderedIds.map((id, index) => this.db.workoutExercises.update(id, { order: index })),
      );
    });
    await this.updateWorkout(workoutId, {});
  }

  async updateWorkoutExercise(id: UUID, patch: Partial<WorkoutExercise>): Promise<void> {
    await this.db.workoutExercises.update(id, patch);
  }

  async addSet(workoutId: UUID, input: NewSetInput): Promise<WorkoutSet> {
    const [set] = await this.addSets(workoutId, [input]);
    if (!set) throw new Error('Failed to add set');
    return set;
  }

  async addSets(workoutId: UUID, inputs: NewSetInput[]): Promise<WorkoutSet[]> {
    const created: WorkoutSet[] = [];
    await this.db.transaction('rw', [this.db.workoutSets, this.db.workouts], async () => {
      for (const input of inputs) {
        const siblings = (
          await this.db.workoutSets
            .where('workoutExerciseId')
            .equals(input.workoutExerciseId)
            .toArray()
        ).sort((a, b) => a.order - b.order);

        const insertIndex = input.afterSetId
          ? siblings.findIndex((set) => set.id === input.afterSetId) + 1
          : siblings.length;

        const set: WorkoutSet = {
          id: uuid(),
          workoutId,
          workoutExerciseId: input.workoutExerciseId,
          order: insertIndex,
          setType: input.setType ?? 'working',
          weightG: input.weightG,
          reps: input.reps,
          rpe: input.rpe,
          rir: input.rir,
          durationSeconds: input.durationSeconds,
          distanceM: input.distanceM,
          isCompleted: input.isCompleted ?? false,
          completedAt: input.isCompleted ? nowIso() : undefined,
          notes: input.notes,
        };

        const shifted = siblings.slice(insertIndex);
        await Promise.all(
          shifted.map((sibling, index) =>
            this.db.workoutSets.update(sibling.id, { order: insertIndex + index + 1 }),
          ),
        );
        await this.db.workoutSets.put(set);
        created.push(set);
      }
      await this.db.workouts.update(workoutId, { updatedAt: nowIso() });
    });
    return created;
  }

  async updateSet(id: UUID, patch: Partial<WorkoutSet>): Promise<void> {
    const next: Partial<WorkoutSet> = { ...patch };
    if (patch.isCompleted === true && !patch.completedAt) next.completedAt = nowIso();
    if (patch.isCompleted === false) next.completedAt = undefined;
    await this.db.workoutSets.update(id, next);
  }

  async deleteSet(id: UUID): Promise<void> {
    await this.db.transaction('rw', this.db.workoutSets, async () => {
      const set = await this.db.workoutSets.get(id);
      if (!set) return;
      await this.db.workoutSets.delete(id);
      const siblings = (
        await this.db.workoutSets.where('workoutExerciseId').equals(set.workoutExerciseId).toArray()
      ).sort((a, b) => a.order - b.order);
      await Promise.all(
        siblings.map((sibling, index) => this.db.workoutSets.update(sibling.id, { order: index })),
      );
    });
  }

  /** Re-inserts a deleted set verbatim — the undo path for an accidental delete. */
  async restoreSet(set: WorkoutSet): Promise<void> {
    await this.db.workoutSets.put(set);
  }

  async getPreviousSetsForExercise(
    exerciseId: UUID,
    beforeWorkoutId?: UUID,
  ): Promise<WorkoutSet[]> {
    const links = await this.db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    if (links.length === 0) return [];
    const workouts = await this.db.workouts.bulkGet(links.map((link) => link.workoutId));

    const candidates = links
      .map((link, index) => ({ link, workout: workouts[index] }))
      .filter(
        (entry): entry is { link: WorkoutExercise; workout: Workout } =>
          !!entry.workout &&
          entry.workout.status === 'completed' &&
          entry.workout.id !== beforeWorkoutId,
      )
      .sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));

    for (const candidate of candidates) {
      const sets = (
        await this.db.workoutSets.where('workoutExerciseId').equals(candidate.link.id).toArray()
      )
        .filter((set) => set.isCompleted)
        .sort((a, b) => a.order - b.order);
      if (sets.length > 0) return sets;
    }
    return [];
  }

  async getSetHistoryForExercise(exerciseId: UUID): Promise<SetWithContext[]> {
    const links = await this.db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    if (links.length === 0) return [];
    const workouts = await this.db.workouts.bulkGet(links.map((link) => link.workoutId));
    const byLink = new Map<string, Workout>();
    links.forEach((link, index) => {
      const workout = workouts[index];
      if (workout && workout.status === 'completed') byLink.set(link.id, workout);
    });

    const sets = await this.db.workoutSets
      .where('workoutExerciseId')
      .anyOf([...byLink.keys()])
      .toArray();

    return sets
      .filter((set) => set.isCompleted)
      .map((set) => {
        const workout = byLink.get(set.workoutExerciseId)!;
        return { ...set, exerciseId, performedAt: workout.startedAt };
      })
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt) || a.order - b.order);
  }

  async getAllCompletedSets(): Promise<
    Array<{ exercise: WorkoutExercise; sets: WorkoutSet[]; workout: Workout }>
  > {
    const workouts = await this.db.workouts.where('status').equals('completed').toArray();
    if (workouts.length === 0) return [];
    const byId = new Map(workouts.map((workout) => [workout.id, workout]));
    const exercises = await this.db.workoutExercises
      .where('workoutId')
      .anyOf(workouts.map((workout) => workout.id))
      .toArray();
    const sets = await this.db.workoutSets
      .where('workoutId')
      .anyOf(workouts.map((workout) => workout.id))
      .toArray();

    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      if (!set.isCompleted) continue;
      const bucket = setsByExercise.get(set.workoutExerciseId);
      if (bucket) bucket.push(set);
      else setsByExercise.set(set.workoutExerciseId, [set]);
    }

    return exercises
      .map((exercise) => ({
        exercise,
        sets: (setsByExercise.get(exercise.id) ?? []).sort((a, b) => a.order - b.order),
        workout: byId.get(exercise.workoutId)!,
      }))
      .filter((entry) => !!entry.workout);
  }

}
