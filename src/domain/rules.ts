import {
  CALIBRATION_VALID_MS,
  DAY_MS,
  SALINITY_MAX,
  SALINITY_MIN,
  SALINITY_TARGET,
  TARGET_TEMPERATURE_C,
  TEMPERATURE_TOLERANCE_C,
} from "./constants";
import type {
  CalibrationRecord,
  CalibrationValues,
  RuleCode,
  RuleViolation,
} from "../data/types";

// 日期键按本地时区划分，“同日每缸仅一条校准”以本地自然日为准
export function localDateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isSameLocalDay(a: Date | string, b: Date | string): boolean {
  return localDateKey(a) === localDateKey(b);
}

/** 该缸在指定自然日是否已有校准确认 */
export function hasCalibrationOnDay(
  all: CalibrationRecord[],
  tankId: string,
  day: Date | string,
): boolean {
  const key = localDateKey(day);
  return all.some(
    (c) =>
      c.tankId === tankId && localDateKey(c.values.calibratedAt) === key,
  );
}

export function isCalibrationExpired(
  values: Pick<CalibrationValues, "calibratedAt">,
  now: Date,
): boolean {
  return now.getTime() - new Date(values.calibratedAt).getTime() >
    CALIBRATION_VALID_MS;
}

export function daysSinceCalibration(
  values: Pick<CalibrationValues, "calibratedAt">,
  now: Date,
): number {
  return Math.floor(
    (now.getTime() - new Date(values.calibratedAt).getTime()) / DAY_MS,
  );
}

/**
 * 补水体积按盐度差估算（盐守恒近似）：
 * 纯水蒸发后盐量不变，补水体积 V = 缸体积 × (实测比重 − 目标比重) / 实测比重。
 * 盐度低于/等于目标时不得补水，返回 0。
 */
export function estimateTopOffLiters(
  salinity: number,
  tankVolumeLiters: number,
): number {
  if (salinity <= SALINITY_TARGET) return 0;
  const raw =
    (tankVolumeLiters * (salinity - SALINITY_TARGET)) / salinity;
  return round2(raw);
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function violation(
  code: RuleCode,
  rule: string,
  detail: string,
): RuleViolation {
  return { code, rule, detail };
}

/** 读数级规则：盐度区间、温度偏差、校准过期 */
export function evaluateCalibrationRules(
  values: CalibrationValues,
  now: Date,
): RuleViolation[] {
  const out: RuleViolation[] = [];

  if (values.salinity < SALINITY_MIN || values.salinity > SALINITY_MAX) {
    out.push(
      violation(
        "SALINITY_RANGE",
        `盐度必须在 ${SALINITY_MIN.toFixed(3)}–${SALINITY_MAX.toFixed(3)} 之间`,
        `实测 ${values.salinity.toFixed(4)}`,
      ),
    );
  }

  const delta = Math.abs(values.temperatureC - TARGET_TEMPERATURE_C);
  if (delta > TEMPERATURE_TOLERANCE_C) {
    out.push(
      violation(
        "TEMPERATURE_DELTA",
        `温度偏离 ${TARGET_TEMPERATURE_C.toFixed(1)}℃ 不得超过 ${TEMPERATURE_TOLERANCE_C.toFixed(1)}℃`,
        `实测 ${values.temperatureC.toFixed(1)}℃，偏差 +${round2(delta)}℃`,
      ),
    );
  }

  if (isCalibrationExpired(values, now)) {
    out.push(
      violation(
        "CALIBRATION_EXPIRED",
        `校准有效期 ${CALIBRATION_VALID_MS / DAY_MS} 天，过期禁止补水`,
        `校准于 ${localDateKey(values.calibratedAt)}，已 ${
          daysSinceCalibration(values, now)
        } 天`,
      ),
    );
  }

  return out;
}

export interface ReleasePlan {
  allowed: boolean;
  estimatedLiters: number;
  violations: RuleViolation[];
}

/**
 * 放行评估：返回估算补水体积与全部命中规则。
 * 顺序：读数规则（盐度/温度/过期）→ 盐度差方向 → 桶余量。
 * 估算体积超过桶余量时整批退回（不做部分放行）。
 */
export function planTopOff(
  calibration: CalibrationRecord | null,
  bucketRemainingLiters: number,
  now: Date,
): ReleasePlan {
  if (!calibration) {
    return {
      allowed: false,
      estimatedLiters: 0,
      violations: [
        violation("NO_CALIBRATION", "该缸无校准版本", "需先登记并确认校准"),
      ],
    };
  }

  const violations = evaluateCalibrationRules(calibration.values, now);
  if (violations.length > 0) {
    return { allowed: false, estimatedLiters: 0, violations };
  }

  const estimated = estimateTopOffLiters(
    calibration.values.salinity,
    calibration.tankVolumeLiters,
  );
  if (estimated <= 0) {
    violations.push(
      violation(
        "SALINITY_BELOW_TARGET",
        `盐度低于或等于目标比重 ${SALINITY_TARGET.toFixed(3)} 时禁止补水（补水会继续稀释）`,
        `实测 ${calibration.values.salinity.toFixed(4)}`,
      ),
    );
    return { allowed: false, estimatedLiters: 0, violations };
  }

  if (estimated > bucketRemainingLiters) {
    violations.push(
      violation(
        "BUCKET_INSUFFICIENT",
        "估算补水体积超过桶余量时整批退回，不做部分补水",
        `需 ${estimated.toFixed(2)}L，桶余 ${bucketRemainingLiters.toFixed(2)}L，缺口 ${
          round2(estimated - bucketRemainingLiters).toFixed(2)
        }L`,
      ),
    );
  }

  return {
    allowed: violations.length === 0,
    estimatedLiters: estimated,
    violations,
  };
}
