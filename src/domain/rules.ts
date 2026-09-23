// 计算层：放行规则（纯函数，不依赖 React 与存储）
import type { CalibrationVersion, Tank } from "../data/types";

/** 盐度放行区间（比重 SG，含边界） */
export const SALINITY_MIN = 1.023;
export const SALINITY_MAX = 1.026;
/** 目标盐度，补水按与它的差值估算 */
export const SALINITY_TARGET = 1.025;
/** 温度容差 °C：|实测 - 目标| 超过该值即禁止补水 */
export const TEMP_TOLERANCE_C = 0.5;
/** 校准有效期：超过 N 天判定校准过期 */
export const CALIBRATION_TTL_DAYS = 7;

export type RuleCode = "SALINITY" | "TEMPERATURE" | "EXPIRED" | "MISSING";

export interface RuleViolation {
  code: RuleCode;
  message: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 本地时区日历日 key，用于"同日每缸仅一条校准" */
export function dayKey(value: string | number | Date): string {
  const d = new Date(value);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isSameLocalDay(a: string | number | Date, b: string | number | Date): boolean {
  return dayKey(a) === dayKey(b);
}

export function isCalibrationExpired(calibratedAt: string, now: number = Date.now()): boolean {
  return now - new Date(calibratedAt).getTime() > CALIBRATION_TTL_DAYS * MS_PER_DAY;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 转为 <input type="datetime-local"> 需要的本地时间值 */
export function toDatetimeLocalValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function checkCalibration(
  version: Pick<CalibrationVersion, "salinity" | "temperatureC" | "calibratedAt">,
  tank: Pick<Tank, "targetTempC">,
  now: number = Date.now(),
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (version.salinity < SALINITY_MIN || version.salinity > SALINITY_MAX) {
    violations.push({
      code: "SALINITY",
      message: `盐度 ${version.salinity.toFixed(3)} 超出放行区间 ${SALINITY_MIN.toFixed(3)}–${SALINITY_MAX.toFixed(3)}`,
    });
  }

  const diff = Math.abs(version.temperatureC - tank.targetTempC);
  if (diff > TEMP_TOLERANCE_C) {
    violations.push({
      code: "TEMPERATURE",
      message: `温度 ${version.temperatureC.toFixed(1)}°C 偏离目标 ${tank.targetTempC.toFixed(1)}°C 达 ${diff.toFixed(1)}°C（容差 ±${TEMP_TOLERANCE_C.toFixed(1)}°C）`,
    });
  }

  if (isCalibrationExpired(version.calibratedAt, now)) {
    violations.push({
      code: "EXPIRED",
      message: `校准已过期：${formatDateTime(version.calibratedAt)} 校准，有效期 ${CALIBRATION_TTL_DAYS} 天`,
    });
  }

  return violations;
}
