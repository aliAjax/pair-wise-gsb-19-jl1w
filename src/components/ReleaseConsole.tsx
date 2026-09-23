import type {
  CalibrationRecord,
  PersistedState,
  RuleViolation,
  Tank,
  TopOffRecord,
} from "../data/types";
import { planTopOff, daysSinceCalibration, isCalibrationExpired } from "../domain/rules";
import {
  fmtDateTime,
  fmtLiters,
  fmtSalinity,
  fmtTemp,
  RULE_SUMMARY,
} from "./format";

interface Props {
  state: PersistedState;
  latest: Map<string, CalibrationRecord>;
  now: Date;
  onRequestTopOff: (tankId: string) =>
    | { record: TopOffRecord }
    | { error: string };
  onNotify: (kind: "ok" | "err", text: string) => void;
}

export function ReleaseConsole({ state, latest, now, onRequestTopOff, onNotify }: Props) {
  const blocked: {
    tank: Tank;
    cal: CalibrationRecord | null;
    violations: RuleViolation[];
  }[] = [];

  const rows = state.tanks.map((tank) => {
    const cal = latest.get(tank.id) ?? null;
    const plan = planTopOff(cal, tank.bucketRemainingLiters, now);
    if (!plan.allowed) blocked.push({ tank, cal, violations: plan.violations });
    return { tank, cal, plan };
  });

  const releasedToday = state.topOffs.filter(
    (t) => t.status === "RELEASED",
  ).length;

  function handleRelease(tankId: string, name: string) {
    const result = onRequestTopOff(tankId);
    if ("error" in result) {
      onNotify("err", result.error);
      return;
    }
    const r = result.record;
    if (r.status === "RELEASED") {
      onNotify(
        "ok",
        `${name} 放行 ${fmtLiters(r.estimatedLiters)}，依据 v${r.calibrationVersion}，桶余量 ${fmtLiters(r.bucketAfterLiters)}`,
      );
    } else {
      onNotify("err", `${name} 补水被整批退回：${r.violations.map((v) => v.rule).join("；")}`);
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">放行规则</p>
            <h2>补水放行台</h2>
          </div>
          <div className="summary-stats">
            <span><strong>{state.tanks.length}</strong> 缸在档</span>
            <span><strong>{blocked.length}</strong> 缸受阻</span>
            <span><strong>{releasedToday}</strong> 张放行单</span>
          </div>
        </div>
        <p className="rule-line">{RULE_SUMMARY}</p>

        <div className="tank-grid">
          {rows.map(({ tank, cal, plan }) => (
            <article
              key={tank.id}
              className={`tank-card ${plan.allowed ? "is-allowed" : "is-blocked"}`}
            >
              <header>
                <div>
                  <span className="tank-id">{tank.id}</span>
                  <h3>{tank.name}</h3>
                </div>
                <span className={`badge ${plan.allowed ? "badge-ok" : "badge-danger"}`}>
                  {plan.allowed ? "可放行" : "禁止补水"}
                </span>
              </header>

              <dl className="reading-grid">
                <div>
                  <dt>盐度</dt>
                  <dd>{cal ? fmtSalinity(cal.values.salinity) : "—"}</dd>
                </div>
                <div>
                  <dt>温度</dt>
                  <dd>{cal ? fmtTemp(cal.values.temperatureC) : "—"}</dd>
                </div>
                <div>
                  <dt>桶余量</dt>
                  <dd>{fmtLiters(tank.bucketRemainingLiters)}</dd>
                </div>
                <div>
                  <dt>校准版本</dt>
                  <dd>
                    {cal
                      ? `v${cal.version} · ${daysSinceCalibration(cal.values, now)}天前${
                          isCalibrationExpired(cal.values, now) ? "（过期）" : ""
                        }`
                      : "无"}
                  </dd>
                </div>
              </dl>

              <p className="cal-time">
                校准时间：{cal ? fmtDateTime(cal.values.calibratedAt) : "—"}
              </p>

              {!plan.allowed && (
                <ul className="violation-list">
                  {plan.violations.map((v) => (
                    <li key={v.code}>
                      <strong>{v.rule}</strong>
                      <span>{v.detail}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="release-row">
                <div className="estimate">
                  <span>估算补水</span>
                  <strong>{fmtLiters(plan.estimatedLiters)}</strong>
                </div>
                <button
                  className="primary-action"
                  disabled={!plan.allowed}
                  onClick={() => handleRelease(tank.id, tank.name)}
                >
                  确认补水放行
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Blocked</p>
            <h2>受阻列</h2>
          </div>
        </div>
        {blocked.length === 0 ? (
          <p className="empty-hint">当前没有受阻鱼缸，均可放行补水。</p>
        ) : (
          <div className="table-wrap">
            <table className="blocked-table">
              <thead>
                <tr>
                  <th>鱼缸</th>
                  <th>盐度</th>
                  <th>温度</th>
                  <th>桶余量</th>
                  <th>依据版本</th>
                  <th>命中规则</th>
                </tr>
              </thead>
              <tbody>
                {blocked.map(({ tank, cal, violations }) => (
                  <tr key={tank.id}>
                    <td>
                      <strong>{tank.id} · {tank.name}</strong>
                      <span className="sub">
                        校准 {cal ? fmtDateTime(cal.values.calibratedAt) : "无"}
                      </span>
                    </td>
                    <td>{cal ? fmtSalinity(cal.values.salinity) : "—"}</td>
                    <td>{cal ? fmtTemp(cal.values.temperatureC) : "—"}</td>
                    <td>{fmtLiters(tank.bucketRemainingLiters)}</td>
                    <td>{cal ? `v${cal.version}` : "无版本"}</td>
                    <td>
                      <ul className="cell-rules">
                        {violations.map((v) => (
                          <li key={v.code} title={v.detail}>{v.rule}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
