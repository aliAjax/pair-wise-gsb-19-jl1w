import { useMemo, useState } from "react";
import type { PersistedState } from "../data/types";
import { evaluateCalibrationRules, hasCalibrationOnDay } from "../domain/rules";
import { nowLocalInputValue } from "./format";

interface Props {
  state: PersistedState;
  onRegister: (input: {
    tankId: string;
    salinity: number;
    temperatureC: number;
    bucketRemainingLiters: number;
    calibratedAt: string;
  }) => { ok: true } | { ok: false; error: string };
  onNotify: (kind: "ok" | "err", text: string) => void;
}

export function CalibrationForm({ state, onRegister, onNotify }: Props) {
  const [tankId, setTankId] = useState(state.tanks[0]?.id ?? "");
  const [salinity, setSalinity] = useState("1.0250");
  const [temperature, setTemperature] = useState("25.0");
  const [bucket, setBucket] = useState("");
  const [calibratedAt, setCalibratedAt] = useState(nowLocalInputValue());

  const tank = state.tanks.find((t) => t.id === tankId);

  const preview = useMemo(() => {
    const s = Number(salinity);
    const temp = Number(temperature);
    const b = Number(bucket);
    const violations: string[] = [];

    if (salinity.trim() === "" || !Number.isFinite(s) || s < 1 || s > 1.1) {
      violations.push("盐度需为约 1.0xx 的有效比重值");
    }
    if (temperature.trim() === "" || !Number.isFinite(temp)) {
      violations.push("温度无效");
    }
    if (bucket.trim() === "" || !Number.isFinite(b) || b < 0) {
      violations.push("桶余量需为非负数字(L)");
    }
    const time = new Date(calibratedAt);
    if (Number.isNaN(time.getTime())) {
      violations.push("校准时间无效");
    } else {
      if (time.getTime() > Date.now() + 60_000) {
        violations.push("校准时间不能晚于当前时间");
      }
      if (hasCalibrationOnDay(state.calibrations, tankId, time)) {
        violations.push("该缸今日已有一条校准（同日每缸仅一条）");
      }
    }

    if (violations.length === 0) {
      violations.push(
        ...evaluateCalibrationRules(
          {
            salinity: s,
            temperatureC: temp,
            bucketRemainingLiters: b,
            calibratedAt: time.toISOString(),
          },
          new Date(),
        ).map((v) => `预检命中：${v.rule}（${v.detail}）——仍可登记冻结，但补水将被禁止`),
      );
    }

    const hardBlocked = violations.some((v) => !v.startsWith("预检命中"));
    return { violations, hardBlocked, nextVersion: tank ? nextVersionOf(state, tankId) : 1 };
  }, [salinity, temperature, bucket, calibratedAt, tankId, state, tank]);

  function submit() {
    const result = onRegister({
      tankId,
      salinity: Number(salinity),
      temperatureC: Number(temperature),
      bucketRemainingLiters: Number(bucket),
      calibratedAt,
    });
    if (!result.ok) {
      onNotify("err", result.error);
      return;
    }
    onNotify("ok", `${tank?.name ?? tankId} 校准已确认并冻结为 v${preview.nextVersion}`);
    setSalinity("1.0250");
    setTemperature("25.0");
    setBucket("");
    setCalibratedAt(nowLocalInputValue());
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Register</p>
          <h2>校准登记</h2>
        </div>
      </div>
      <p className="rule-line">
        每缸登记盐度、温度、桶余量和校准时间；确认后立即冻结数值与版本。同一自然日每缸仅允许一条校准。
      </p>

      <div className="form-grid">
        <label className="span-2">
          <span>鱼缸</span>
          <select value={tankId} onChange={(e) => setTankId(e.target.value)}>
            {state.tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.name}（水体 {t.volumeLiters}L）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>盐度（比重 1.023–1.026）</span>
          <input
            type="number"
            step="0.0001"
            min="1"
            max="1.1"
            value={salinity}
            onChange={(e) => setSalinity(e.target.value)}
          />
        </label>
        <label>
          <span>温度（℃，25.0 ± 0.5）</span>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </label>
        <label>
          <span>补水桶余量（L）</span>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="如 12.5"
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
          />
        </label>
        <label>
          <span>校准时间</span>
          <input
            type="datetime-local"
            value={calibratedAt}
            onChange={(e) => setCalibratedAt(e.target.value)}
          />
        </label>
      </div>

      <div className={`preview-box ${preview.hardBlocked ? "preview-err" : "preview-watch"}`}>
        <p>
          确认后将冻结为 <strong>v{preview.nextVersion}</strong>，预检：
        </p>
        <ul>
          {preview.violations.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      </div>

      <div className="form-actions">
        <button className="primary-action" disabled={preview.hardBlocked} onClick={submit}>
          确认校准并冻结
        </button>
      </div>
    </section>
  );
}

function nextVersionOf(state: PersistedState, tankId: string): number {
  return (
    state.calibrations
      .filter((c) => c.tankId === tankId)
      .reduce((max, c) => Math.max(max, c.version), 0) + 1
  );
}
