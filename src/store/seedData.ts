// 存储层：演示数据（覆盖放行、禁止、过期、无需补水、桶余量不足等各场景）
import type { CalibrationVersion, StationState, Tank, TopUpRecord } from "../data/types";

const DAY = 24 * 60 * 60 * 1000;

/** 以今天为基准生成校准时间，保证演示数据随日期滚动 */
function atDaysAgo(daysAgo: number, hour = 9, minute = 30): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function buildSeedState(storageVersion: number): StationState {
  const tanks: Tank[] = [
    { id: "t1", name: "SPS 展示缸", volumeL: 300, targetTempC: 25 },
    { id: "t2", name: "LPS 软体缸", volumeL: 200, targetTempC: 25 },
    { id: "t3", name: "繁殖检疫缸", volumeL: 120, targetTempC: 24.5 },
    { id: "t4", name: "小丑鱼育成缸", volumeL: 180, targetTempC: 25 },
    { id: "t5", name: "藻缸过滤槽", volumeL: 80, targetTempC: 25 },
    { id: "t6", name: "隔离检疫缸", volumeL: 60, targetTempC: 25 },
  ];

  const confirmedAt = atDaysAgo(0, 8, 0);

  const versions: CalibrationVersion[] = [
    // t1：盐度偏高但在区间内，温度正常，今天校准，桶余量充足 → 可放行补水
    {
      id: "v-t1-1", tankId: "t1", versionNo: 1,
      salinity: 1.026, temperatureC: 25.1, bucketRemainingL: 40,
      calibratedAt: atDaysAgo(0), confirmedAt, status: "active",
    },
    // t2：盐度超出上限 → 禁止
    {
      id: "v-t2-1", tankId: "t2", versionNo: 1,
      salinity: 1.027, temperatureC: 25.0, bucketRemainingL: 25,
      calibratedAt: atDaysAgo(1), confirmedAt, status: "active",
    },
    // t3：目标 24.5°C，实测 25.1°C，偏离 0.6°C → 禁止
    {
      id: "v-t3-1", tankId: "t3", versionNo: 1,
      salinity: 1.025, temperatureC: 25.1, bucketRemainingL: 15,
      calibratedAt: atDaysAgo(2), confirmedAt, status: "active",
    },
    // t4：校准 9 天前 → 过期禁止
    {
      id: "v-t4-1", tankId: "t4", versionNo: 1,
      salinity: 1.025, temperatureC: 25.0, bucketRemainingL: 20,
      calibratedAt: atDaysAgo(9), confirmedAt: atDaysAgo(9), status: "active",
    },
    // t5：盐度正好目标 → 无需补水（calm）
    {
      id: "v-t5-1", tankId: "t5", versionNo: 1,
      salinity: 1.025, temperatureC: 24.8, bucketRemainingL: 10,
      calibratedAt: atDaysAgo(3), confirmedAt, status: "active",
    },
    // t6：规则全部满足但补水桶余量为 0 → 整批放行时退回
    {
      id: "v-t6-1", tankId: "t6", versionNo: 1,
      salinity: 1.026, temperatureC: 25.0, bucketRemainingL: 0,
      calibratedAt: atDaysAgo(0), confirmedAt, status: "active",
    },
    // t1 的历史版本：5 天前校准，已被当前版本替代
    {
      id: "v-t1-0", tankId: "t1", versionNo: 0,
      salinity: 1.024, temperatureC: 25.0, bucketRemainingL: 45,
      calibratedAt: atDaysAgo(5, 10), confirmedAt: atDaysAgo(5, 10),
      status: "superseded",
    },
  ];

  const topups: TopUpRecord[] = [
    {
      id: "tp-t1-old1", tankId: "t1", versionId: "v-t1-0",
      liters: 1.2, salinityAtRelease: 1.024,
      bucketBeforeL: 45, bucketAfterL: 43.8,
      releasedAt: atDaysAgo(4, 16),
    },
  ];

  return { storageVersion, tanks, versions, topups };
}
