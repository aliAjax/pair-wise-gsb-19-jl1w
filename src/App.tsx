import { useEffect, useState } from "react";
import "./styles.css";
import { selectLatestCalibrations, useStore } from "./storage/useStore";
import { ReleaseConsole } from "./components/ReleaseConsole";
import { CalibrationForm } from "./components/CalibrationForm";
import { VersionHistory } from "./components/VersionHistory";
import { fmtDateTime } from "./components/format";

type Tab = "release" | "calibrate" | "versions";

const TABS: { key: Tab; label: string }[] = [
  { key: "release", label: "补水放行台" },
  { key: "calibrate", label: "校准登记" },
  { key: "versions", label: "版本档案" },
];

interface Notice {
  id: number;
  kind: "ok" | "err";
  text: string;
}

function App() {
  const {
    state,
    registerCalibration,
    correctCalibration,
    requestTopOff,
    resetToSeed,
  } = useStore();
  const [tab, setTab] = useState<Tab>("release");
  const [now, setNow] = useState(() => new Date());
  const [notices, setNotices] = useState<Notice[]>([]);

  // 放行评估依赖当前时间（过期判定），每 30 秒刷新一次
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const latest = selectLatestCalibrations(state);

  function notify(kind: "ok" | "err", text: string) {
    const id = Date.now() + Math.random();
    setNotices((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => {
      setNotices((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-05 · 海水缸盐度校准与补水放行台</p>
          <h1>盐度校准 · 补水放行</h1>
          <p className="subtitle">
            每缸登记盐度、温度、桶余量和校准时间；规则命中即禁止补水，
            补水量按盐度差估算，超桶余量整批退回；确认即冻结版本，修正写原因另存旧值。
          </p>
        </div>
        <div className="stack-card">
          <span>当前时间（过期判定基准）</span>
          <strong>{fmtDateTime(now.toISOString())}</strong>
          <button
            className="reset-btn"
            onClick={() => {
              resetToSeed();
              notify("ok", "已恢复演示数据");
            }}
          >
            恢复演示数据
          </button>
        </div>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="notice-stack">
        {notices.map((n) => (
          <div key={n.id} className={`notice ${n.kind === "ok" ? "notice-ok" : "notice-err"}`}>
            {n.text}
          </div>
        ))}
      </div>

      {tab === "release" && (
        <ReleaseConsole
          state={state}
          latest={latest}
          now={now}
          onRequestTopOff={requestTopOff}
          onNotify={notify}
        />
      )}
      {tab === "calibrate" && (
        <CalibrationForm state={state} onRegister={registerCalibration} onNotify={notify} />
      )}
      {tab === "versions" && (
        <VersionHistory state={state} onCorrect={correctCalibration} onNotify={notify} />
      )}

      <footer className="footnote">
        数据、计算、存储、页面分层：data（结构/种子）· domain（规则引擎）· storage（localStorage 仓库）· components（页面）
      </footer>
    </main>
  );
}

export default App;
