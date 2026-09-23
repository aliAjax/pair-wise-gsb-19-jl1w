// 页面层：补水放行台（规则判定结果来自计算层，此处只渲染与发起整批放行）
import { useEffect, useState } from "react";
import type { TankEvaluation } from "../../domain/calculation";

interface Props {
  evaluations: TankEvaluation[];
  onRelease: (
    items: { tankId: string; tankName: string; addLiters: number; bucketL: number }[],
  ) => boolean;
}

export function ReleaseBoard({ evaluations, onRelease }: Props) {
  const eligible = evaluations.filter((e) => e.status === "eligible");
  const blocked = evaluations.filter(
    (e) => e.status === "blocked" || e.status === "uncalibrated",
  );
  const calm = evaluations.filter((e) => e.status === "calm");

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  // 可放行集合变化后同步勾选项（默认全选当前可放行缸）
  useEffect(() => {
    setSelected(new Set(eligible.map((e) => e.tank.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible.map((e) => `${e.tank.id}:${e.version?.id}:${e.bucketL}`).join("|")]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }

  const chosen = eligible.filter((e) => selected.has(e.tank.id));
  const total = Math.round(chosen.reduce((s, e) => s + e.addLiters, 0) * 10) / 10;

  function handleRelease() {
    if (chosen.length === 0) {
      setMessage({ kind: "warn", text: "请至少选择一个可放行缸" });
      return;
    }
    const ok = onRelease(
      chosen.map((e) => ({
        tankId: e.tank.id,
        tankName: e.tank.name,
        addLiters: e.addLiters,
        bucketL: e.bucketL ?? 0,
      })),
    );
    if (ok) {
      setMessage({
        kind: "ok",
        text: `已放行 ${chosen.length} 缸共 ${total}L 补水，各缸桶余量已扣减并记入版本流水`,
      });
    }
  }

  return (
    <section className="panel release-board">
      <div className="section-heading">
        <div>
          <p>放行台</p>
          <h2>补水放行（整批）</h2>
        </div>
        <div className="batch-summary">
          <span>
            已选 <strong>{chosen.length}</strong> 缸 · 合计 <strong>{total.toFixed(1)}</strong> L
          </span>
          <button className="primary-action" onClick={handleRelease}>
            确认整批放行补水
          </button>
        </div>
      </div>

      {message && (
        <p className={"form-notice " + (message.kind === "ok" ? "notice-ok" : "notice-warn")}>
          {message.text}
        </p>
      )}

      <h3 className="table-title ok-title">可放行（盐度偏高、规则全部满足、桶余量充足）</h3>
      {eligible.length === 0 ? (
        <p className="empty-note">当前没有满足放行条件的缸。</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-check">选择</th>
              <th>鱼缸</th>
              <th>盐度 SG</th>
              <th>温度 °C</th>
              <th>估算补水 L</th>
              <th>桶余量 L</th>
              <th>依据版本</th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((e) => (
              <tr key={e.tank.id}>
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(e.tank.id)}
                    onChange={() => toggle(e.tank.id)}
                  />
                </td>
                <td className="cell-name">{e.tank.name}</td>
                <td>{e.version!.salinity.toFixed(3)}</td>
                <td>
                  {e.version!.temperatureC.toFixed(1)}
                  <span className="muted-text"> / 目标 {e.tank.targetTempC.toFixed(1)}</span>
                </td>
                <td className="num-strong">{e.addLiters.toFixed(1)}</td>
                <td className={e.addLiters > (e.bucketL ?? 0) ? "num-danger" : ""}>
                  {(e.bucketL ?? 0).toFixed(1)}
                </td>
                <td className="muted-text">v{e.version!.versionNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {calm.length > 0 && (
        <>
          <h3 className="table-title calm-title">盐度正常 · 无需补水</h3>
          <ul className="calm-list">
            {calm.map((e) => (
              <li key={e.tank.id}>
                {e.tank.name}
                <span className="muted-text">
                  {" "}
                  · 盐度 {e.version!.salinity.toFixed(3)} · 温度 {e.version!.temperatureC.toFixed(1)}°C
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="table-title danger-title">受阻 · 禁止补水</h3>
      {blocked.length === 0 ? (
        <p className="empty-note">没有受阻鱼缸。</p>
      ) : (
        <table className="data-table blocked-table">
          <thead>
            <tr>
              <th>鱼缸</th>
              <th>盐度 SG</th>
              <th>桶余量 L</th>
              <th>受阻规则</th>
            </tr>
          </thead>
          <tbody>
            {blocked.map((e) => (
              <tr key={e.tank.id}>
                <td className="cell-name">{e.tank.name}</td>
                <td>{e.version ? e.version.salinity.toFixed(3) : "—"}</td>
                <td>{e.bucketL === undefined ? "—" : `${e.bucketL.toFixed(1)} L`}</td>
                <td>
                  <ul className="reason-list">
                    {e.violations.map((v) => (
                      <li key={v.code} className={`reason-code code-${v.code.toLowerCase()}`}>
                        <span className="reason-tag">{ruleLabel(v.code)}</span>
                        {v.message}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ruleLabel(code: string): string {
  switch (code) {
    case "SALINITY":
      return "盐度";
    case "TEMPERATURE":
      return "温度";
    case "EXPIRED":
      return "过期";
    case "MISSING":
      return "未校准";
    default:
      return code;
  }
}
