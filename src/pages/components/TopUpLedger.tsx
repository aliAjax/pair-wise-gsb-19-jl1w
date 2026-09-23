// 页面层：补水放行流水（每条补水都能回溯到具体校准版本）
import type { Tank, TopUpRecord } from "../../data/types";
import { formatDateTime } from "../../domain/rules";

interface Props {
  topups: TopUpRecord[];
  tanks: Tank[];
  versionNoOf: (versionId: string) => number | undefined;
}

export function TopUpLedger({ topups, tanks, versionNoOf }: Props) {
  const tankName = (id: string) => tanks.find((t) => t.id === id)?.name ?? id;
  const sorted = [...topups].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>补水流水（与版本对应）</p>
          <h2>放行记录</h2>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="empty-note">尚无补水放行记录。</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>放行时间</th>
                <th>鱼缸</th>
                <th>依据版本</th>
                <th>放行时盐度</th>
                <th>补水量 L</th>
                <th>放行前桶余量</th>
                <th>放行后桶余量</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>{formatDateTime(t.releasedAt)}</td>
                  <td className="cell-name">{tankName(t.tankId)}</td>
                  <td className="muted-text">v{versionNoOf(t.versionId) ?? "?"}</td>
                  <td>{t.salinityAtRelease.toFixed(3)}</td>
                  <td className="num-strong">{t.liters.toFixed(1)}</td>
                  <td>{t.bucketBeforeL.toFixed(1)}</td>
                  <td>{t.bucketAfterL.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
