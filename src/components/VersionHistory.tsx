import { useState } from "react";
import type {
  CalibrationRecord,
  PersistedState,
  RegisterCalibrationInput,
} from "../data/types";
import {
  FIELD_LABELS,
  fmtDateTime,
  fmtFieldValue,
  fmtLiters,
  fmtSalinity,
  fmtTemp,
  nowLocalInputValue,
} from "./format";

interface Props {
  state: PersistedState;
  onCorrect: (
    calibrationId: string,
    reason: string,
    patch: Partial<RegisterCalibrationInput>,
  ) => { ok: true } | { ok: false; error: string };
  onNotify: (kind: "ok" | "err", text: string) => void;
}

export function VersionHistory({ state, onCorrect, onNotify }: Props) {
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const tank = state.tanks.find((t) => t.id === tankId);

  const versions = state.calibrations
    .filter((c) => c.tankId === tankId)
    .sort((a, b) => b.version - a.version);
  const topOffs = state.topOffs
    .filter((t) => t.tankId === tankId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const corrections = state.corrections
    .filter((c) => c.tankId === tankId)
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="stack">
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Versions</p>
            <h2>校准版本档案</h2>
          </div>
          <select
            className="tank-select"
            value={tankId}
            onChange={(e) => setTankId(e.target.value)}
          >
            {state.tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}
              </option>
            ))}
          </select>
        </div>
        <p className="rule-line">
          确认后的版本冻结不可改；修正须填写原因并另存为新版本，旧值完整保留在审计记录中。补水单回链所依据的校准版本。
        </p>

        <div className="version-list">
          {versions.map((c) => {
            const linked = state.topOffs.filter((t) => t.calibrationId === c.id);
            const isLatest = versions[0]?.id === c.id;
            return (
              <article
                key={c.id}
                className={`version-card ${c.reason ? "is-correction" : ""}`}
              >
                <header>
                  <div>
                    <span className="badge badge-neutral">v{c.version}</span>
                    {c.reason && <span className="badge badge-warn">修正版</span>}
                    {isLatest && <span className="badge badge-ok">当前生效</span>}
                  </div>
                  <span className="sub">冻结于 {fmtDateTime(c.frozenAt)}</span>
                </header>

                <dl className="reading-grid">
                  <div>
                    <dt>盐度</dt>
                    <dd>{fmtSalinity(c.values.salinity)}</dd>
                  </div>
                  <div>
                    <dt>温度</dt>
                    <dd>{fmtTemp(c.values.temperatureC)}</dd>
                  </div>
                  <div>
                    <dt>桶余量</dt>
                    <dd>{fmtLiters(c.values.bucketRemainingLiters)}</dd>
                  </div>
                  <div>
                    <dt>校准时间</dt>
                    <dd>{fmtDateTime(c.values.calibratedAt)}</dd>
                  </div>
                </dl>

                {c.reason && (
                  <p className="reason-line">
                    修正原因：{c.reason}（由 v{c.version - 1} 另存而来，旧版本仍保留）
                  </p>
                )}

                {linked.length > 0 && (
                  <div className="linked-topoffs">
                    <span>对应补水单：</span>
                    {linked.map((t) => (
                      <span
                        key={t.id}
                        className={`badge ${t.status === "RELEASED" ? "badge-ok" : "badge-danger"}`}
                      >
                        {t.id} · {t.status === "RELEASED" ? "放行" : "退回"} ·{" "}
                        {fmtLiters(t.estimatedLiters)} · {fmtDateTime(t.at)}
                      </span>
                    ))}
                  </div>
                )}

                {isLatest && (
                  <CorrectionForm
                    key={c.id}
                    calibration={c}
                    onCorrect={onCorrect}
                    onNotify={onNotify}
                  />
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Audit</p>
            <h2>{tank?.id} 修正审计与补水记录</h2>
          </div>
        </div>

        <h3 className="sub-heading">修正原因与旧值</h3>
        {corrections.length === 0 ? (
          <p className="empty-hint">暂无修正记录。</p>
        ) : (
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>版本变化</th>
                  <th>原因</th>
                  <th>旧值 → 新值</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((cor) => (
                  <tr key={cor.id}>
                    <td>{fmtDateTime(cor.at)}</td>
                    <td>v{cor.fromVersion} → v{cor.toVersion}</td>
                    <td>{cor.reason}</td>
                    <td>
                      <ul className="change-list">
                        {cor.changes.map((ch) => (
                          <li key={ch.field}>
                            {FIELD_LABELS[ch.field]}：
                            <del>{fmtFieldValue(ch.field, ch.oldValue)}</del>
                            {" → "}
                            <ins>{fmtFieldValue(ch.field, ch.newValue)}</ins>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="sub-heading">补水单据（与校准版本对应）</h3>
        {topOffs.length === 0 ? (
          <p className="empty-hint">暂无补水记录。</p>
        ) : (
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>单号</th>
                  <th>时间</th>
                  <th>校准版本</th>
                  <th>估算体积</th>
                  <th>桶余量变化</th>
                  <th>结果 / 规则</th>
                </tr>
              </thead>
              <tbody>
                {topOffs.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{fmtDateTime(t.at)}</td>
                    <td>v{t.calibrationVersion}</td>
                    <td>{fmtLiters(t.estimatedLiters)}</td>
                    <td>
                      {fmtLiters(t.bucketBeforeLiters)}
                      {" → "}
                      {t.bucketAfterLiters === null
                        ? "未扣减"
                        : fmtLiters(t.bucketAfterLiters)}
                    </td>
                    <td>
                      {t.status === "RELEASED" ? (
                        <span className="badge badge-ok">已放行</span>
                      ) : (
                        <ul className="cell-rules">
                          {t.violations.map((v) => (
                            <li key={v.code} title={v.detail}>整批退回：{v.rule}</li>
                          ))}
                        </ul>
                      )}
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

function CorrectionForm({
  calibration,
  onCorrect,
  onNotify,
}: {
  calibration: CalibrationRecord;
  onCorrect: Props["onCorrect"];
  onNotify: Props["onNotify"];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [salinity, setSalinity] = useState("");
  const [temperature, setTemperature] = useState("");
  const [bucket, setBucket] = useState("");
  const [calibratedAt, setCalibratedAt] = useState("");

  function submit() {
    const patch: Partial<RegisterCalibrationInput> = {};
    if (salinity.trim() !== "") patch.salinity = Number(salinity);
    if (temperature.trim() !== "") patch.temperatureC = Number(temperature);
    if (bucket.trim() !== "") patch.bucketRemainingLiters = Number(bucket);
    if (calibratedAt.trim() !== "") patch.calibratedAt = calibratedAt;

    const result = onCorrect(calibration.id, reason, patch);
    if (!result.ok) {
      onNotify("err", result.error);
      return;
    }
    onNotify("ok", `v${calibration.version} 已修正并另存为 v${calibration.version + 1}，旧值保留`);
    setReason("");
    setSalinity("");
    setTemperature("");
    setBucket("");
    setCalibratedAt("");
    setOpen(false);
  }

  if (!open) {
    return (
      <div className="form-actions">
        <button onClick={() => setOpen(true)}>修正本版本（写原因另存旧值）</button>
      </div>
    );
  }

  return (
    <div className="correction-box">
      <p className="sub">仅填写需要修正的字段，留空项沿用冻结值；确认后生成下一版本，本版本不动。</p>
      <div className="form-grid">
        <label>
          <span>新盐度（当前 {fmtSalinity(calibration.values.salinity)}）</span>
          <input
            type="number"
            step="0.0001"
            value={salinity}
            onChange={(e) => setSalinity(e.target.value)}
            placeholder="留空不修改"
          />
        </label>
        <label>
          <span>新温度℃（当前 {fmtTemp(calibration.values.temperatureC)}）</span>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="留空不修改"
          />
        </label>
        <label>
          <span>新桶余量L（当前 {fmtLiters(calibration.values.bucketRemainingLiters)}）</span>
          <input
            type="number"
            step="0.1"
            min="0"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="留空不修改"
          />
        </label>
        <label>
          <span>新校准时间</span>
          <input
            type="datetime-local"
            value={calibratedAt || nowLocalInputValue(new Date(calibration.values.calibratedAt))}
            onChange={(e) => setCalibratedAt(e.target.value)}
          />
        </label>
        <label className="span-2">
          <span>修正原因（必填）</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如：折光仪零位漂移，盐度读数偏高"
          />
        </label>
      </div>
      <div className="form-actions">
        <button
          className="primary-action"
          disabled={reason.trim() === ""}
          onClick={submit}
        >
          确认修正并冻结新版本
        </button>
        <button onClick={() => setOpen(false)}>取消</button>
      </div>
    </div>
  );
}
