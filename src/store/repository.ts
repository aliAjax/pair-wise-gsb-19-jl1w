// 存储层：localStorage 仓储（持久化只在此文件出现）
import type { StationState } from "../data/types";
import { buildSeedState } from "./seedData";

const STORAGE_KEY = "reef-release-station:v1";
const STORAGE_VERSION = 1;

export function loadState(): StationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StationState;
      if (parsed.storageVersion === STORAGE_VERSION) return parsed;
    }
  } catch {
    // 存储不可读时回退到演示数据
  }
  return buildSeedState(STORAGE_VERSION);
}

export function saveState(state: StationState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可写时仅影响刷新后保留
  }
}

export function resetState(): StationState {
  const seed = buildSeedState(STORAGE_VERSION);
  saveState(seed);
  return seed;
}
