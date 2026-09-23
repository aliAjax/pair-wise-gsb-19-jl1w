import {
  CALIBRATION_VALID_DAYS,
  SALINITY_MAX,
  SALINITY_MIN,
  SALINITY_TARGET,
  TARGET_TEMPERATURE_C,
  TEMPERATURE_TOLERANCE_C,
} from "../domain/constants";
import type { CalibrationField } from "../data/types";

export function fmtSalinity(v: number): string {
  return v.toFixed(4);
}

export function fmtTemp(v: number): string {
  return `${v.toFixed(1)}℃`;
}

export function fmtLiters(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}L`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function nowLocalInputValue(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export const FIELD_LABELS: Record<CalibrationField, string> = {
  salinity: "盐度",
  temperatureC: "温度(℃)",
  bucketRemainingLiters: "桶余量(L)",
  calibratedAt: "校准时间",
};

export function fmtFieldValue(field: CalibrationField, v: number | string): string {
  if (field === "salinity") return fmtSalinity(Number(v));
  if (field === "temperatureC") return fmtTemp(Number(v));
  if (field === "bucketRemainingLiters") return fmtLiters(Number(v));
  return fmtDateTime(String(v));
}

export const RULE_SUMMARY =
  `盐度 ${SALINITY_MIN.toFixed(3)}–${SALINITY_MAX.toFixed(3)}；` +
  `温度 ${TARGET_TEMPERATURE_C.toFixed(1)}℃±${TEMPERATURE_TOLERANCE_C.toFixed(1)}；` +
  `校准 ${CALIBRATION_VALID_DAYS} 天内有效；` +
  `补水按盐度差向 ${SALINITY_TARGET.toFixed(3)} 估算，超桶余量整批退回`;
