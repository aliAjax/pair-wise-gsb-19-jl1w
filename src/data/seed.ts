import type {
  CalibrationRecord,
  PersistedState,
  Tank,
  TopOffRecord,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

interface SeedTank {
  tank: Omit<Tank, "bucketRemainingLiters">;
  bucket: number;
  salinity: number;
  temperatureC: number;
  ageDays: number;
}

const SEED_TANKS: SeedTank[] = [
  {
    tank: { id: "T1", name: "海缸A · 软体混养", volumeLiters: 500 },
    bucket: 19.9,
    salinity: 1.0252,
    temperatureC: 25.1,
    ageDays: 1,
  },
  {
    tank: { id: "T2", name: "海缸B · FOT纯鱼", volumeLiters: 320 },
    bucket: 8,
    salinity: 1.027,
    temperatureC: 25.0,
    ageDays: 1,
  },
  {
    tank: { id: "T3", name: "海缸C · 检疫缸", volumeLiters: 180 },
    bucket: 10,
    salinity: 1.0254,
    temperatureC: 26.0,
    ageDays: 2,
  },
  {
    tank: { id: "T4", name: "海缸D · 珊瑚繁殖", volumeLiters: 260 },
    bucket: 6,
    salinity: 1.0255,
    temperatureC: 25.2,
    ageDays: 12,
  },
  {
    tank: { id: "T5", name: "海缸E · SPS展示缸", volumeLiters: 800 },
    bucket: 0.5,
    salinity: 1.026,
    temperatureC: 25.0,
    ageDays: 0,
  },
  {
    tank: { id: "T6", name: "海缸F · 新缸养水", volumeLiters: 200 },
    bucket: 5,
    salinity: 1.0235,
    temperatureC: 24.8,
    ageDays: 3,
  },
];

/** 种子按当前时刻生成，保证“有效 / 过期”等状态在演示时立即可见 */
export function buildSeedState(now: Date = new Date()): PersistedState {
  const tanks: Tank[] = [];
  const calibrations: CalibrationRecord[] = [];
  const topOffs: TopOffRecord[] = [];

  SEED_TANKS.forEach((s, index) => {
    const calibratedAt = new Date(now.getTime() - s.ageDays * DAY_MS);
    tanks.push({
      ...s.tank,
      bucketRemainingLiters: s.bucket,
    });
    calibrations.push({
      id: `cal-${index + 1}`,
      tankId: s.tank.id,
      version: 1,
      values: {
        salinity: s.salinity,
        temperatureC: s.temperatureC,
        bucketRemainingLiters: s.bucket,
        calibratedAt: calibratedAt.toISOString(),
      },
      tankVolumeLiters: s.tank.volumeLiters,
      frozenAt: calibratedAt.toISOString(),
      replacesId: null,
      reason: null,
    });
  });

  // T1 在 v1 冻结时已放行过一次 0.10L 补水，演示“补水单 ↔ 校准版本”对应
  topOffs.push({
    id: "to-1",
    tankId: "T1",
    calibrationId: "cal-1",
    calibrationVersion: 1,
    estimatedLiters: 0.1,
    bucketBeforeLiters: 20,
    bucketAfterLiters: 19.9,
    status: "RELEASED",
    violations: [],
    at: new Date(now.getTime() - 1 * DAY_MS).toISOString(),
  });

  return {
    schemaVersion: 1,
    tanks,
    calibrations,
    topOffs,
    corrections: [],
  };
}
