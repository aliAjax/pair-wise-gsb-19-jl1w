// 计算层：盐度差补水估算、缸状态评估、整批放行判定（纯函数）
import type {
  CalibrationVersion,
  Tank,
  TopUpRecord,
} from "../data/types";
import {
  SALINITY_TARGET,
  checkCalibration,
  type RuleViolation,
} from "./rules";

/** 保留 1 位小数 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 按盐度差估算淡水补水量（L）：
 * 补水后盐度回到目标值，V补 = V缸 × (当前SG - 目标SG) / 目标SG
 * 盐度不高于目标时无需补水，返回 0。
 */
export function estimateTopUpLiters(salinity: number, tankVolumeL: number): number {
  if (salinity <= SALINITY_TARGET) return 0;
  return round1((tankVolumeL * (salinity - SALINITY_TARGET)) / SALINITY_TARGET);
}

/** 该缸当前有效版本（唯一 active） */
export function activeVersion(
  versions: CalibrationVersion[],
  tankId: string,
): CalibrationVersion | undefined {
  return versions
    .filter((v) => v.tankId === tankId && v.status === "active")
    .sort((a, b) => b.versionNo - a.versionNo)[0];
}

/** 某冻结版本自校准以来补水累计扣减量 */
export function releasedOnVersion(topups: TopUpRecord[], versionId: string): number {
  return round1(
    topups
      .filter((t) => t.versionId === versionId)
      .reduce((sum, t) => sum + t.liters, 0),
  );
}

/** 桶当前余量 = 校准确认时冻结余量 - 该版本已放行补水 */
export function currentBucketRemaining(
  version: CalibrationVersion,
  topups: TopUpRecord[],
): number {
  return round1(version.bucketRemainingL - releasedOnVersion(topups, version.id));
}

export type TankGateStatus = "eligible" | "calm" | "blocked" | "uncalibrated";

export interface TankEvaluation {
  tank: Tank;
  version?: CalibrationVersion;
  status: TankGateStatus;
  violations: RuleViolation[];
  /** 按盐度差估算的本次应补水量 L */
  addLiters: number;
  /** 桶当前余量 L（未校准则为 undefined） */
  bucketL?: number;
}

/** 综合规则对单缸做出放行评估 */
export function evaluateTank(
  tank: Tank,
  versions: CalibrationVersion[],
  topups: TopUpRecord[],
  now: number = Date.now(),
): TankEvaluation {
  const version = activeVersion(versions, tank.id);
  if (!version) {
    return {
      tank,
      status: "uncalibrated",
      violations: [{ code: "MISSING", message: "尚未登记有效校准，禁止补水" }],
      addLiters: 0,
    };
  }

  const violations = checkCalibration(version, tank, now);
  const addLiters = estimateTopUpLiters(version.salinity, tank.volumeL);
  const bucketL = currentBucketRemaining(version, topups);

  let status: TankGateStatus;
  if (violations.length > 0) status = "blocked";
  else if (addLiters === 0) status = "calm";
  else status = "eligible";

  return { tank, version, status, violations, addLiters, bucketL };
}

export interface BatchItem {
  tankId: string;
  tankName: string;
  addLiters: number;
  bucketL: number;
}

export type BatchPlan =
  | { ok: true; items: BatchItem[]; totalLiters: number }
  | { ok: false; items: BatchItem[]; totalLiters: number; exceeded: BatchItem[] };

/**
 * 整批判定：任一缸估算补水量超过其桶余量，则整批退回，
 * 不允许部分放行（由调用方保证不扣减任何余量）。
 */
export function planRelease(items: BatchItem[]): BatchPlan {
  const totalLiters = round1(items.reduce((s, i) => s + i.addLiters, 0));
  const exceeded = items.filter((i) => i.addLiters > i.bucketL);
  if (exceeded.length > 0) {
    return { ok: false, items, totalLiters, exceeded };
  }
  return { ok: true, items, totalLiters };
}
