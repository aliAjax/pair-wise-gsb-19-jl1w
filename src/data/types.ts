// 数据层：领域对象结构定义，不含任何计算与存储逻辑

export interface Tank {
  id: string;
  name: string;
  /** 缸内水体体积(L)，用于按盐度差估算补水体积 */
  volumeLiters: number;
  /** 淡水补水桶当前余量(L)，随放行补水扣减 */
  bucketRemainingLiters: number;
}

export type RuleCode =
  | "SALINITY_RANGE"
  | "TEMPERATURE_DELTA"
  | "CALIBRATION_EXPIRED"
  | "SALINITY_BELOW_TARGET"
  | "BUCKET_INSUFFICIENT"
  | "NO_CALIBRATION";

export interface RuleViolation {
  code: RuleCode;
  /** 规则描述（受阻列“规则”一列直接展示） */
  rule: string;
  /** 实测值与判定细节 */
  detail: string;
}

/** 一次校准确认时冻结下来的读数 */
export interface CalibrationValues {
  salinity: number;
  temperatureC: number;
  bucketRemainingLiters: number;
  /** 校准时间（ISO 字符串） */
  calibratedAt: string;
}

export interface CalibrationRecord {
  id: string;
  tankId: string;
  /** 缸内递增版本号：v1、v2……确认即冻结 */
  version: number;
  values: CalibrationValues;
  tankVolumeLiters: number;
  /** 冻结时刻 */
  frozenAt: string;
  /** 修正来源：若非 null 表示本版本由该旧版本修正而来，旧版本原样保留 */
  replacesId: string | null;
  /** 修正原因（仅修正产生的版本有值） */
  reason: string | null;
}

export type CalibrationField = keyof CalibrationValues;

export interface CorrectionChange {
  field: CalibrationField;
  oldValue: number | string;
  newValue: number | string;
}

/** 修正审计：原因与旧值另存，不覆盖冻结版本 */
export interface CorrectionRecord {
  id: string;
  tankId: string;
  reason: string;
  fromCalibrationId: string;
  fromVersion: number;
  toCalibrationId: string;
  toVersion: number;
  changes: CorrectionChange[];
  at: string;
}

export type TopOffStatus = "RELEASED" | "REJECTED";

/** 补水单：与所依据的校准版本一一对应 */
export interface TopOffRecord {
  id: string;
  tankId: string;
  calibrationId: string;
  calibrationVersion: number;
  estimatedLiters: number;
  bucketBeforeLiters: number;
  bucketAfterLiters: number | null;
  status: TopOffStatus;
  /** REJECTED 时携带触发的全部规则 */
  violations: RuleViolation[];
  at: string;
}

export interface PersistedState {
  schemaVersion: 1;
  tanks: Tank[];
  calibrations: CalibrationRecord[];
  topOffs: TopOffRecord[];
  corrections: CorrectionRecord[];
}

export interface RegisterCalibrationInput {
  tankId: string;
  salinity: number;
  temperatureC: number;
  bucketRemainingLiters: number;
  calibratedAt: string;
}
