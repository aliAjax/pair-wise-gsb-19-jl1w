// 页面层：全部鱼缸登记台账与实时评估
import type { TankEvaluation } from "../../domain/calculation";
import { CALIBRATION_TTL_DAYS, formatDateTime, isCalibrationExpired } from "../../domain/rules";

const statusMeta: Record<
  TankEvaluation["status"],
  { label: string; className: string }
> = {
  eligible: { label: "可放行补水", className: "tag-ok" },
  calm: { label: "盐度正常", className: "tag-calm" },
  blocked: { label: "禁止补水", className: "tag-danger" },
  uncalibrated: { label: "未校准", className: "tag-muted" },
};

export function TankOverview({ evaluations }: { evaluations: TankEvaluation[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>鱼缸登记</p>
          <h2>每缸校准台账（有效期 {CALIBRATION_TTL_DAYS} 天）</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>鱼缸</th>
              <th>水量 L</th>
              <th>盐度 SG</th>
              <th>温度 °C</th>
              <th>桶余量 L</th>
              <th>校准时间</th>
              <th>估算补水 L</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => {
              const meta = statusMeta[e.status];
              const expired = e.version && isCalibrationExpired(e.version.calibratedAt);
              return (
                <tr key={e.tank.id}>
                  <td className="cell-name">{e.tank.name}</td>
                  <td>{e.tank.volumeL}</td>
                  <td>{e.version ? e.version.salinity.toFixed(3) : "—"}</td>
                  <td>
                    {e.version ? e.version.temperatureC.toFixed(1) : "—"}
                    <span className="muted-text"> / {e.tank.targetTempC.toFixed(1)}</span>
                  </td>
                  <td>{e.bucketL === undefined ? "—" : e.bucketL.toFixed(1)}</td>
                  <td className={expired ? "num-danger" : ""}>
                    {e.version ? formatDateTime(e.version.calibratedAt) : "—"}
                  </td>
                  <td className="num-strong">{e.addLiters.toFixed(1)}</td>
                  <td>
                    <span className={"status-tag " + meta.className}>{meta.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
