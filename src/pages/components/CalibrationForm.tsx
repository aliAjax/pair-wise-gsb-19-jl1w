// 页面层：校准登记 / 重开修正表单（确认前可改，确认后由存储层冻结）
import { useMemo, useState } from "react";
import type { CalibrationVersion, Tank } from "../../data/types";
import {
  SALINITY_MAX,
  SALINITY_MIN,
  TEMP_TOLERANCE_C,
  isSameLocalDay,
  toDatetimeLocalValue,
} from "../../domain/rules";

interface Props {
  tanks: Tank[];
  versions: CalibrationVersion[];
  onConfirm: (
    input: {
      tankId: string;
      salinity: number;
      temperatureC: number;
      bucketRemainingL: number;
      calibratedAt: string;
    },
    correctionReason: string | undefined,
  ) => string;
  onAddTank: (tank: { name: string; volumeL: number; targetTempC: number }) => void;
}

export function CalibrationForm({ tanks, versions, onConfirm, onAddTank }: Props) {
  const [tankId, setTankId] = useState(tanks[0]?.id ?? "");
  const [salinity, setSalinity] = useState("1.025");
  const [temperature, setTemperature] = useState("25.0");
  const [bucket, setBucket] = useState("20");
  const [calibratedAt, setCalibratedAt] = useState(() => toDatetimeLocalValue());
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);

  // 新缸登记
  const [newName, setNewName] = useState("");
  const [newVolume, setNewVolume] = useState("");
  const [newTemp, setNewTemp] = useState("25.0");
  const [showNewTank, setShowNewTank] = useState(false);

  const selectedTank = tanks.find((t) => t.id === tankId);
  const current = useMemo(
    () =>
      versions
        .filter((v) => v.tankId === tankId && v.status === "active")
        .sort((a, b) => b.versionNo - a.versionNo)[0],
    [versions, tankId],
  );

  const isSameDay = !!current && isSameLocalDay(current.calibratedAt, calibratedAt);
  const nextVersionNo =
    versions.filter((v) => v.tankId === tankId).reduce((m, v) => Math.max(m, v.versionNo), 0) + 1;

  function selectTank(id: string) {
    setTankId(id);
    setNotice(null);
    setReason("");
    const tank = tanks.find((t) => t.id === id);
    if (tank) setTemperature(tank.targetTempC.toFixed(1));
  }

  function validate(): string | null {
    const s = Number(salinity);
    const temp = Number(temperature);
    const b = Number(bucket);
    if (!tankId) return "请选择鱼缸";
    if (!salinity || Number.isNaN(s) || s < 1 || s > 1.1) return "盐度应在 1.000–1.100 之间";
    if (!temperature || Number.isNaN(temp) || temp < 0 || temp > 40) return "温度应在 0–40°C 之间";
    if (bucket === "" || Number.isNaN(b) || b < 0) return "桶余量不能为负";
    if (!calibratedAt) return "请填写校准时间";
    if (isSameDay && !reason.trim()) return "同日重开校准属于修正，必须填写原因";
    void selectedTank;
    return null;
  }

  function handleSubmit() {
    const error = validate();
    if (error) {
      setNotice({ kind: "warn", text: error });
      return;
    }
    const msg = onConfirm(
      {
        tankId,
        salinity: Number(salinity),
        temperatureC: Number(temperature),
        bucketRemainingL: Number(bucket),
        calibratedAt: new Date(calibratedAt).toISOString(),
      },
      isSameDay ? reason.trim() : undefined,
    );
    setNotice({ kind: "ok", text: msg });
    setReason("");
  }

  function handleAddTank() {
    const name = newName.trim();
    const volume = Number(newVolume);
    const temp = Number(newTemp);
    if (!name) {
      setNotice({ kind: "warn", text: "请填写缸名" });
      return;
    }
    if (!newVolume || Number.isNaN(volume) || volume <= 0) {
      setNotice({ kind: "warn", text: "缸体水量需为正数（L）" });
      return;
    }
    if (!newTemp || Number.isNaN(temp)) {
      setNotice({ kind: "warn", text: "目标温度无效" });
      return;
    }
    onAddTank({ name, volumeL: volume, targetTempC: temp });
    setNewName("");
    setNewVolume("");
    setNewTemp("25.0");
    setShowNewTank(false);
    setNotice({ kind: "ok", text: `已登记鱼缸「${name}」，请继续校准登记` });
  }

  return (
    <section className="panel" id="calibration">
      <div className="section-heading">
        <div>
          <p>校准登记台</p>
          <h2>登记 / 重开校准</h2>
        </div>
        <button className="ghost-action" onClick={() => setShowNewTank((v) => !v)}>
          {showNewTank ? "收起新缸登记" : "登记新缸"}
        </button>
      </div>

      {showNewTank && (
        <div className="new-tank-grid">
          <label>
            <span>缸名</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例：断枝培育缸" />
          </label>
          <label>
            <span>缸体水量 L</span>
            <input
              type="number"
              value={newVolume}
              onChange={(e) => setNewVolume(e.target.value)}
              placeholder="用于按盐度差估算补水"
            />
          </label>
          <label>
            <span>目标温度 °C</span>
            <input
              type="number"
              step="0.1"
              value={newTemp}
              onChange={(e) => setNewTemp(e.target.value)}
            />
          </label>
          <div className="grid-action">
            <button className="primary-action" onClick={handleAddTank}>
              登记鱼缸
            </button>
          </div>
        </div>
      )}

      <div className="form-grid">
        <label className="span-2">
          <span>鱼缸</span>
          <select value={tankId} onChange={(e) => selectTank(e.target.value)}>
            {tanks.map((tank) => (
              <option key={tank.id} value={tank.id}>
                {tank.name}（{tank.volumeL}L，目标 {tank.targetTempC.toFixed(1)}°C）
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>
            盐度 SG（放行区间 {SALINITY_MIN.toFixed(3)}–{SALINITY_MAX.toFixed(3)}）
          </span>
          <input
            type="number"
            step="0.001"
            min="1"
            max="1.1"
            value={salinity}
            onChange={(e) => setSalinity(e.target.value)}
          />
        </label>
        <label>
          <span>温度 °C（容差 ±{TEMP_TOLERANCE_C.toFixed(1)}°C）</span>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </label>
        <label>
          <span>补水桶余量 L（确认时冻结）</span>
          <input
            type="number"
            step="0.1"
            min="0"
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

      {current && (
        <div className={"frozen-hint " + (isSameDay ? "hint-warn" : "hint-info")}>
          <div>
            <strong>
              当前有效：v{current.versionNo} · {current.salinity.toFixed(3)} SG ·{" "}
              {current.temperatureC.toFixed(1)}°C · 桶余量 {current.bucketRemainingL}L
            </strong>
            <p>
              确认后将冻结为 <strong>v{nextVersionNo}</strong>，旧版数值原样保留、不再改写。
              {isSameDay
                ? " 同日该缸已有校准，本次属于「修正重开」，必须填写原因；同日仍只保留一条有效校准。"
                : ""}
            </p>
          </div>
        </div>
      )}

      {isSameDay && (
        <label className="reason-field">
          <span>修正原因（同日重开必填，随新版本保存）</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：比重计发现气泡，复测盐度修正为 1.025"
            rows={2}
          />
        </label>
      )}

      {notice && (
        <p className={"form-notice " + (notice.kind === "ok" ? "notice-ok" : "notice-warn")}>
          {notice.text}
        </p>
      )}

      <div className="form-actions">
        <button className="primary-action" onClick={handleSubmit}>
          {isSameDay ? "确认修正并冻结新版本" : current ? "重开校准并冻结新版本" : "确认冻结校准"}
        </button>
      </div>
    </section>
  );
}
