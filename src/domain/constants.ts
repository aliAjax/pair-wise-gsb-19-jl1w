// 放行台硬规则（计算层唯一参数来源）
export const SALINITY_MIN = 1.023;
export const SALINITY_MAX = 1.026;
/** 目标比重：盐度差补水估算的回归目标 */
export const SALINITY_TARGET = 1.025;

export const TARGET_TEMPERATURE_C = 25.0;
/** 允许温度偏差（含边界，超过即禁止补水） */
export const TEMPERATURE_TOLERANCE_C = 0.5;

/** 校准有效期：超过 N 天视为过期 */
export const CALIBRATION_VALID_DAYS = 7;
export const CALIBRATION_VALID_MS =
  CALIBRATION_VALID_DAYS * 24 * 60 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;
