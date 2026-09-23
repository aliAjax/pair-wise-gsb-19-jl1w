// 数据层：海水缸校准放行台的领域模型（与存储、界面无关）

/** 鱼缸主数据（校准登记之外的固定台账） */
export interface Tank {
  id: string;
  name: string;
  /** 缸体水量 L，用于按盐度差估算补水体积 */
  volumeL: number;
  /** 目标温度 °C，温度容差按缸判定 */
  targetTempC: number;
}

/** 校准版本状态：active 当前唯一有效版本；superseded 已被替代（旧值原样保留） */
export type CalibrationStatus = "active" | "superseded";

/** 一条已冻结的校准记录，数值永不再改写 */
export interface CalibrationVersion {
  id: string;
  tankId: string;
  /** 该缸第 N 版，确认冻结时自增 */
  versionNo: number;
  /** 盐度（比重 SG） */
  salinity: number;
  /** 温度 °C */
  temperatureC: number;
  /** 校准确认时的补淡水桶余量 L */
  bucketRemainingL: number;
  /** 校准时间（ISO 字符串，登记时可改） */
  calibratedAt: string;
  /** 确认冻结时间 */
  confirmedAt: string;
  status: CalibrationStatus;
  /** 仅旧版本：是否因同日修正而被替代（旧值原样保留，只加此留痕） */
  supersededByCorrection?: boolean;
  /** 仅新版本：同日重开时必填的修正原因 */
  correctionReason?: string;
  previousVersionId?: string;
}

/** 补水放行流水，必须挂在某一条冻结校准版本上 */
export interface TopUpRecord {
  id: string;
  tankId: string;
  /** 补水依据的校准版本，保证补水与版本对应 */
  versionId: string;
  liters: number;
  salinityAtRelease: number;
  bucketBeforeL: number;
  bucketAfterL: number;
  releasedAt: string;
}

export interface StationState {
  storageVersion: number;
  tanks: Tank[];
  versions: CalibrationVersion[];
  topups: TopUpRecord[];
}

/** 登记/重开校准的录入值（确认前尚未冻结） */
export interface CalibrationInput {
  tankId: string;
  salinity: number;
  temperatureC: number;
  bucketRemainingL: number;
  calibratedAt: string;
}
