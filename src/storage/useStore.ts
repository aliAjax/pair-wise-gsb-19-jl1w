import { useCallback, useSyncExternalStore } from "react";
import { DomainError, Repository } from "./repository";
import type {
  CalibrationRecord,
  PersistedState,
  RegisterCalibrationInput,
  TopOffRecord,
} from "../data/types";

const repository = new Repository();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): PersistedState {
  return repository.state;
}

/** 页面层只读快照；所有变更经仓库方法提交并广播 */
export function useStore() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const registerCalibration = useCallback(
    (input: RegisterCalibrationInput) => {
      try {
        repository.registerCalibration(input);
        emit();
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: describe(err) };
      }
    },
    [],
  );

  const correctCalibration = useCallback(
    (calibrationId: string, reason: string, patch: Partial<RegisterCalibrationInput>) => {
      try {
        repository.correctCalibration(calibrationId, reason, patch);
        emit();
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: describe(err) };
      }
    },
    [],
  );

  const requestTopOff = useCallback(
    (tankId: string): { record: TopOffRecord } | { error: string } => {
      try {
        const { record } = repository.requestTopOff(tankId);
        emit();
        return { record };
      } catch (err) {
        return { error: describe(err) };
      }
    },
    [],
  );

  const resetToSeed = useCallback(() => {
    repository.resetToSeed();
    emit();
  }, []);

  return {
    state,
    registerCalibration,
    correctCalibration,
    requestTopOff,
    resetToSeed,
  };
}

/** 各缸最新冻结版本（补水放行唯一依据） */
export function selectLatestCalibrations(
  state: PersistedState,
): Map<string, CalibrationRecord> {
  const map = new Map<string, CalibrationRecord>();
  for (const c of state.calibrations) {
    const cur = map.get(c.tankId);
    if (!cur || c.version > cur.version) map.set(c.tankId, c);
  }
  return map;
}

function describe(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof Error) return err.message;
  return "操作失败";
}
