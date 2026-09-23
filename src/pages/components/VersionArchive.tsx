// 页面层：校准版本归档 —— 冻结数值、版本递增、修正旧值原样另存
import type { CalibrationVersion, Tank } from "../../data/types";
import { formatDateTime, isCalibrationExpired } from "../../domain/rules";

interface Props {
  versions: CalibrationVersion[];
  tanks: Tank[];
}

export function VersionArchive({ versions, tanks }: Props) {
  const tankName = (id: string) => tanks.find((t) => t.id === id)?.name ?? id;
  const sorted = [...versions].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>版本归档（只追加，不改写）</p>
          <h2>校准版本与修正留痕</h2>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>鱼缸</th>
              <th>版本</th>
              <th>盐度 SG</th>
              <th>温度 °C</th>
              <th>桶余量 L</th>
              <th>校准时间</th>
              <th>确认冻结时间</th>
              <th>状态 / 修正原因</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const expired = isCalibrationExpired(v.calibratedAt);
              return (
                <tr key={v.id} className={v.status === "superseded" ? "row-superseded" : ""}>
                  <td className="cell-name">{tankName(v.tankId)}</td>
                  <td className="num-strong">v{v.versionNo}</td>
                  <td>{v.salinity.toFixed(3)}</td>
                  <td>{v.temperatureC.toFixed(1)}</td>
                  <td>{v.bucketRemainingL.toFixed(1)}</td>
                  <td className={v.status === "active" && expired ? "num-danger" : ""}>
                    {formatDateTime(v.calibratedAt)}
                  </td>
                  <td className="muted-text">{formatDateTime(v.confirmedAt)}</td>
                  <td>
                    {v.status === "active" ? (
                      <span className="status-tag tag-ok">
                        当前有效{expired ? " · 已过期" : ""}
                      </span>
                    ) : (
                      <span className="status-tag tag-muted">
                        {v.supersededByCorrection ? "同日修正替代" : "重开替代"}
                      </span>
                    )}
                    {v.correctionReason && (
                      <p className="correction-reason">
                        <span className="reason-tag">修正</span>
                        {v.correctionReason}
                      </p>
                    )}
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
