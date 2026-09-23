// 存储层：状态机（冻结、同日修正、整批放行、重开登记）
import type {
  CalibrationInput,
  CalibrationVersion,
  StationState,
  Tank,
  TopUpRecord,
} from "../data/types";
import {
  activeVersion,
  planRelease,
  type BatchItem,
} from "../domain/calculation";
import { isSameLocalDay } from "../domain/rules";
import { buildSeedState } from "./seedData";

export type Action =
  | {
      type: "confirm-calibration";
      input: CalibrationInput;
      /** 同日重开时必填的修正原因 */
      correctionReason?: string;
    }
  | { type: "release"; items: BatchItem[]; now?: number }
  | { type: "add-tank"; tank: Omit<Tank, "id"> }
  | { type: "reset" };

function uid(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

export function nextVersionNo(state: StationState, tankId: string): number {
  return state.versions
    .filter((v) => v.tankId === tankId)
    .reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
}

/**
 * 确认校准：
 * - 数值与版本即刻冻结，之后永不改写；
 * - 同日该缸已有校准 => 按"修正"处理：旧值原样另存，仅状态转 superseded，
 *   新版本记录修正原因（同日仍只保留一条有效校准）；
 * - 非同日 => 旧 active 版本正常失效，版本号递增。
 */
export function stationReducer(state: StationState, action: Action): StationState {
  switch (action.type) {
    case "confirm-calibration": {
      const { input, correctionReason } = action;
      const nowIso = new Date().toISOString();
      const current = activeVersion(state.versions, input.tankId);
      const isSameDayCorrection =
        !!current && isSameLocalDay(current.calibratedAt, input.calibratedAt);

      // 同日修正必须给出原因
      if (isSameDayCorrection && (!correctionReason || !correctionReason.trim())) {
        return state;
      }

      const newVersion: CalibrationVersion = {
        id: uid("v"),
        tankId: input.tankId,
        versionNo: nextVersionNo(state, input.tankId),
        salinity: input.salinity,
        temperatureC: input.temperatureC,
        bucketRemainingL: input.bucketRemainingL,
        calibratedAt: input.calibratedAt,
        confirmedAt: nowIso,
        status: "active",
        correctionReason: isSameDayCorrection ? correctionReason!.trim() : undefined,
        previousVersionId: current?.id,
      };

      // 旧值不改写：仅状态置为 superseded；同日修正时在旧版本上留痕
      const versions = state.versions.map((v) =>
        v.id === current?.id
          ? {
              ...v,
              status: "superseded" as const,
              supersededByCorrection: isSameDayCorrection ? true : v.supersededByCorrection,
            }
          : v,
      );
      versions.push(newVersion);

      return { ...state, versions };
    }

    case "release": {
      // 整批判定：任一缸补水量超过桶余量，整批退回、不扣减任何余量
      const plan = planRelease(action.items);
      if (!plan.ok) return state;

      const nowIso = new Date(action.now ?? Date.now()).toISOString();
      const records: TopUpRecord[] = plan.items.map((item) => {
        const version = activeVersion(state.versions, item.tankId);
        return {
          id: uid("tp"),
          tankId: item.tankId,
          versionId: version!.id,
          liters: item.addLiters,
          salinityAtRelease: version!.salinity,
          bucketBeforeL: item.bucketL,
          bucketAfterL: Math.round((item.bucketL - item.addLiters) * 10) / 10,
          releasedAt: nowIso,
        };
      });

      return { ...state, topups: [...state.topups, ...records] };
    }

    case "add-tank": {
      const tank: Tank = { id: uid("t"), ...action.tank };
      return { ...state, tanks: [...state.tanks, tank] };
    }

    case "reset":
      return buildSeedState(state.storageVersion);

    default:
      return state;
  }
}
