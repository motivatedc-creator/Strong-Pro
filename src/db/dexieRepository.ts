export { APP_VERSION, defaultSettings } from './dexieRepository.core';
export { DexieRepository } from './dexieRepository.rest';
export {
  ActiveWorkoutExistsError,
  snapshotExercise,
  defaultWorkoutName,
} from './dexieRepository.helpers';

import type { RepForgeRepository } from './repository';
import { DexieRepository } from './dexieRepository.rest';

let repository: RepForgeRepository | null = null;

export function getRepository(): RepForgeRepository {
  if (!repository) repository = new DexieRepository();
  return repository;
}

/** Test hook: swap the repository implementation (e.g. a fake or a SQLite adapter). */
export function setRepository(next: RepForgeRepository | null): void {
  repository = next;
}
