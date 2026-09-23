// 页面层：放行台总编排（组合数据、计算、存储，不放业务规则）
import { useMemo } from "react";
import { useStation } from "../store/useStation";
import {
  evaluateTank,
  planRelease,
  type BatchItem,
} from "../domain/calculation";
import {
  CALIBRATION_TTL_DAYS,
  SALINITY_MAX,
  SALINITY_MIN,
  SALINITY_TARGET,
  TEMP_TOLERANCE_C,
  isSameLocalDay,
} from "../domain/rules";
import type { CalibrationInput } from "../data/types";
import { CalibrationForm } from "./components/CalibrationForm";
import { ReleaseBoard } from "./components/ReleaseBoard";
import { TankOverview } from "./components/TankOverview";
import { VersionArchive } from "./components/VersionArchive";
import { TopUpLedger } from "./components/TopUpLedger";

export function StationPage() {
  const { state, actions } = useStation();

  const evaluations = useMemo(
    () => state.tanks.map((tank) => evaluateTank(tank, state.versions, state.topups)),
    [state.tanks, state.versions, state.topups],
  );

  const versionNoOf = (versionId: string) =>
    state.versions.find((v) => v.id === versionId)?.versionNo;

  function handleConfirm(input: CalibrationInput, correctionReason: string | undefined): string {
    const existing = state.versions
      .filter((v) => v.tankId === input.tankId && v.status === "active")
      .sort((a, b) => b.versionNo - a.versionNo)[0];
    actions.confirmCalibration(input, correctionReason);
    const tankName = state.tanks.find((t) => t.id === input.tankId)?.name ?? "";
    if (existing) {
      return isSameLocalDay(existing.calibratedAt, input.calibratedAt)
        ? `已按修正重开：${tankName} 旧值原样归档，新数值与版本已冻结（同日仅一条有效校准）`
        : `已重开校准：${tankName} 新版本已冻结，旧版本标记失效但数值保留`;
    }
    return `已登记并冻结 ${tankName} 的校准版本`;
  }

  function handleRelease(items: BatchItem[]): boolean {
    const plan = planRelease(items);
    if (!plan.ok) {
      const names = plan.exceeded
        .map((i) => `${i.tankName}（需 ${i.addLiters.toFixed(1)}L / 余 ${i.bucketL.toFixed(1)}L）`)
        .join("、");
      window.alert(`整批退回：${names} 的补水桶余量不足，本批 ${plan.totalLiters.toFixed(1)}L 全部未放行，未扣减任何余量。`);
      return false;
    }
    actions.release(items);
    return true;
  }

  const metrics = [
    { label: "盐度放行区间", value: `${SALINITY_MIN.toFixed(3)}–${SALINITY_MAX.toFixed(3)}`, sub: `目标 ${SALINITY_TARGET.toFixed(3)} SG` },
    { label: "温度容差", value: `±${TEMP_TOLERANCE_C.toFixed(1)}°C`, sub: "超过即禁止补水" },
    { label: "校准有效期", value: `${CALIBRATION_TTL_DAYS} 天`, sub: "过期即禁止补水" },
    { label: "整批放行", value: "余量不足整批退", sub: "超桶余量不扣减任何余量" },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">reef-release-station · 海水缸放行台</p>
          <h1>海水缸盐度校准与补水放行台</h1>
          <p className="subtitle">
            每缸登记盐度、温度、补水桶余量与校准时间；规则不满足禁止补水，补水量按盐度差估算，
            超桶余量整批退回。确认即冻结数值与版本，同日重开须写修正原因、旧值原样另存。
          </p>
        </div>
        <div className="stack-card">
          <span>数据 / 计算 / 存储 / 页面 分层</span>
          <strong>React + TypeScript · localStorage 持久化</strong>
          <button className="ghost-action reset-btn" onClick={actions.reset}>
            恢复演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((m) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <p className="metric-sub">{m.sub}</p>
          </article>
        ))}
      </section>

      <ReleaseBoard evaluations={evaluations} onRelease={handleRelease} />

      <section className="workspace">
        <CalibrationForm
          tanks={state.tanks}
          versions={state.versions}
          onConfirm={handleConfirm}
          onAddTank={actions.addTank}
        />
      </section>

      <TankOverview evaluations={evaluations} />

      <div className="ledger-stack">
        <VersionArchive versions={state.versions} tanks={state.tanks} />
        <TopUpLedger topups={state.topups} tanks={state.tanks} versionNoOf={versionNoOf} />
      </div>

      <footer className="page-footer">
        规则：盐度 {SALINITY_MIN.toFixed(3)}–{SALINITY_MAX.toFixed(3)} SG（目标{" "}
        {SALINITY_TARGET.toFixed(3)}）、温度偏离超 {TEMP_TOLERANCE_C.toFixed(1)}°C 禁补、校准超{" "}
        {CALIBRATION_TTL_DAYS} 天禁补；同日每缸仅一条有效校准；补水体积 V = 缸水量 × (当前盐度 −
        目标盐度) / 目标盐度。
      </footer>
    </main>
  );
}
