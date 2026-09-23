import type {
  CalibrationField,
  CalibrationRecord,
  CalibrationValues,
  CorrectionRecord,
  PersistedState,
  RegisterCalibrationInput,
  Tank,
  TopOffRecord,
} from "../data/types";
import { buildSeedState } from "../data/seed";
import { hasCalibrationOnDay, planTopOff, round2 } from "../domain/rules";

const STORAGE_KEY = "reef-release-console:v1";

export class DomainError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

function nextId(prefix: string, existing: { id: string }[]): string {
  let max = 0;
  for (const item of existing) {
    const n = Number(item.id.split("-").pop());
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}-${max + 1}`;
}

/** 读取持久化数据；损坏或缺旧时整体回退到种子数据 */
export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      parsed.schemaVersion !== 1 ||
      !Array.isArray(parsed.tanks) ||
      !Array.isArray(parsed.calibrations) ||
      !Array.isArray(parsed.topOffs) ||
      !Array.isArray(parsed.corrections)
    ) {
      return buildSeedState();
    }
    return parsed;
  } catch {
    return buildSeedState();
  }
}

function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export class Repository {
  state: PersistedState;

  constructor(initial?: PersistedState) {
    this.state = initial ?? loadState();
  }

  private commit(next: PersistedState): PersistedState {
    this.state = next;
    saveState(next);
    return next;
  }

  private tankOrThrow(tankId: string): Tank {
    const tank = this.state.tanks.find((t) => t.id === tankId);
    if (!tank) throw new DomainError("TANK_NOT_FOUND", "鱼缸不存在");
    return tank;
  }

  /** 每缸最新版本（version 最大者） */
  latestCalibration(tankId: string): CalibrationRecord | null {
    let latest: CalibrationRecord | null = null;
    for (const c of this.state.calibrations) {
      if (c.tankId === tankId && (!latest || c.version > latest.version)) {
        latest = c;
      }
    }
    return latest;
  }

  resetToSeed(): PersistedState {
    return this.commit(buildSeedState());
  }

  /**
   * 登记并确认校准（确认即冻结、分配版本）。
   * 同一缸同一自然日仅允许一条校准，重复直接拒绝。
   */
  registerCalibration(
    input: RegisterCalibrationInput,
    now: Date = new Date(),
  ): PersistedState {
    this.tankOrThrow(input.tankId);

    if (
      hasCalibrationOnDay(this.state.calibrations, input.tankId, input.calibratedAt)
    ) {
      throw new DomainError(
        "CALIBRATION_DUPLICATE_DAY",
        "同一缸每日仅允许一条校准记录，今日该缸已确认过校准",
      );
    }
    if (Number.isNaN(new Date(input.calibratedAt).getTime())) {
      throw new DomainError("INVALID_TIME", "校准时间无效");
    }

    const version =
      this.state.calibrations
        .filter((c) => c.tankId === input.tankId)
        .reduce((max, c) => Math.max(max, c.version), 0) + 1;

    const values: CalibrationValues = {
      salinity: input.salinity,
      temperatureC: input.temperatureC,
      bucketRemainingLiters: input.bucketRemainingLiters,
      calibratedAt: new Date(input.calibratedAt).toISOString(),
    };

    const record: CalibrationRecord = {
      id: nextId("cal", this.state.calibrations),
      tankId: input.tankId,
      version,
      values,
      tankVolumeLiters: this.tankOrThrow(input.tankId).volumeLiters,
      frozenAt: now.toISOString(),
      replacesId: null,
      reason: null,
    };

    const tanks = this.state.tanks.map((t) =>
      t.id === input.tankId
        ? { ...t, bucketRemainingLiters: input.bucketRemainingLiters }
        : t,
    );

    return this.commit({
      ...this.state,
      tanks,
      calibrations: [...this.state.calibrations, record],
    });
  }

  /**
   * 修正冻结版本：旧版本原样保留，另起新版本，
   * 原因与每一项旧值/新值写入修正审计。
   */
  correctCalibration(
    calibrationId: string,
    reason: string,
    patch: Partial<RegisterCalibrationInput>,
    now: Date = new Date(),
  ): PersistedState {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new DomainError("REASON_REQUIRED", "修正必须填写原因");
    }
    const old = this.state.calibrations.find((c) => c.id === calibrationId);
    if (!old) {
      throw new DomainError("CALIBRATION_NOT_FOUND", "待修正的版本不存在");
    }

    const mergedValues: CalibrationValues = {
      ...old.values,
      ...(patch.salinity !== undefined ? { salinity: patch.salinity } : {}),
      ...(patch.temperatureC !== undefined
        ? { temperatureC: patch.temperatureC }
        : {}),
      ...(patch.bucketRemainingLiters !== undefined
        ? { bucketRemainingLiters: patch.bucketRemainingLiters }
        : {}),
      ...(patch.calibratedAt !== undefined
        ? { calibratedAt: new Date(patch.calibratedAt).toISOString() }
        : {}),
    };

    const fields: CalibrationField[] = [
      "salinity",
      "temperatureC",
      "bucketRemainingLiters",
      "calibratedAt",
    ];
    const changes = fields
      .filter((f) => old.values[f] !== mergedValues[f])
      .map((field) => ({
        field,
        oldValue: old.values[field],
        newValue: mergedValues[field],
      }));

    if (changes.length === 0) {
      throw new DomainError("NO_CHANGE", "没有任何数值发生变化");
    }

    const version =
      this.state.calibrations
        .filter((c) => c.tankId === old.tankId)
        .reduce((max, c) => Math.max(max, c.version), 0) + 1;

    const record: CalibrationRecord = {
      id: nextId("cal", this.state.calibrations),
      tankId: old.tankId,
      version,
      values: mergedValues,
      tankVolumeLiters: old.tankVolumeLiters,
      frozenAt: now.toISOString(),
      replacesId: old.id,
      reason: trimmed,
    };

    const audit: CorrectionRecord = {
      id: nextId("cor", this.state.corrections),
      tankId: old.tankId,
      reason: trimmed,
      fromCalibrationId: old.id,
      fromVersion: old.version,
      toCalibrationId: record.id,
      toVersion: version,
      changes,
      at: now.toISOString(),
    };

    const tanks =
      patch.bucketRemainingLiters !== undefined
        ? this.state.tanks.map((t) =>
            t.id === old.tankId
              ? {
                  ...t,
                  bucketRemainingLiters: mergedValues.bucketRemainingLiters,
                }
              : t,
          )
        : this.state.tanks;

    return this.commit({
      ...this.state,
      tanks,
      calibrations: [...this.state.calibrations, record],
      corrections: [...this.state.corrections, audit],
    });
  }

  /**
   * 请求补水放行：无论放行与否都留单据。
   * 放行时按估算体积扣减桶余量；命中规则则整批退回，桶余量不变。
   */
  requestTopOff(tankId: string, now: Date = new Date()): {
    state: PersistedState;
    record: TopOffRecord;
  } {
    const tank = this.tankOrThrow(tankId);
    const calibration = this.latestCalibration(tankId);
    const plan = planTopOff(calibration, tank.bucketRemainingLiters, now);

    const released = plan.allowed;
    const before = tank.bucketRemainingLiters;
    const after = released
      ? round2(before - plan.estimatedLiters)
      : null;

    const record: TopOffRecord = {
      id: nextId("to", this.state.topOffs),
      tankId,
      calibrationId: calibration?.id ?? "",
      calibrationVersion: calibration?.version ?? 0,
      estimatedLiters: plan.estimatedLiters,
      bucketBeforeLiters: before,
      bucketAfterLiters: after,
      status: released ? "RELEASED" : "REJECTED",
      violations: plan.violations,
      at: now.toISOString(),
    };

    const tanks = released
      ? this.state.tanks.map((t) =>
          t.id === tankId ? { ...t, bucketRemainingLiters: after ?? t.bucketRemainingLiters } : t,
        )
      : this.state.tanks;

    const next = this.commit({
      ...this.state,
      tanks,
      topOffs: [...this.state.topOffs, record],
    });

    return { state: next, record };
  }
}
