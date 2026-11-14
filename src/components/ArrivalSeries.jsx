// AI-assisted component. Faithful arrival-date series for the selected point, from the
// same computed events as the comparison table. Not a ranking or a recommendation.
import { useMemo } from 'react';
import { arrivalSeries } from '../lib/arrivalSeries.mjs';
import { percent, hours } from '../lib/analysis.mjs';

const W = 720, ROW = 70, LEFT = 4;

export default function ArrivalSeries({ siteData, siteName, period, height, days, selectedDate, onSelect }) {
  const series = useMemo(() => arrivalSeries(siteData, period, height, days), [siteData, period, height, days]);
  if (!series.length)
    return (
      <section className="chart-section arrival-series" aria-labelledby="arrival-series-title">
        <h2 id="arrival-series-title">Every arrival date in the computed period</h2>
        <p role="status">Not calculated for this window length.</p>
      </section>
    );
  const maxDark = Math.max(1, ...series.map(s => s.summary?.dark.hours ?? 0));
  const bw = (W - LEFT) / series.length;
  return (
    <section className="chart-section arrival-series" aria-labelledby="arrival-series-title">
      <h2 id="arrival-series-title">Every arrival date in the computed period</h2>
      <p>
        {siteName} · {height} m · {days}-day operating window starting at 00:00 UTC on each date. Same faithful
        calculation as the table above; choose a date to use it as your arrival.
      </p>
      <svg className="arrival-series-chart" viewBox={`0 0 ${W} ${ROW * 2 + 34}`} role="img"
        aria-label={`Longest darkness and Earth visibility for ${series.length} arrival dates. A table follows.`}>
        <text x={LEFT} y="11" className="arrival-series-label">Longest darkness (h, ≥ = lower bound)</text>
        <text x={LEFT} y={ROW + 27} className="arrival-series-label">Earth visible (% of time)</text>
        {series.map((s, k) => {
          const x = LEFT + k * bw;
          const dark = s.summary?.dark;
          const dh = dark ? (dark.hours / maxDark) * (ROW - 20) : 0;
          const eh = s.summary ? s.summary.earthFraction * (ROW - 20) : 0;
          const sel = s.date === selectedDate;
          return (
            <g key={s.date} className={'arrival-series-day' + (sel ? ' is-selected' : '')}>
              <rect className={'arrival-series-dark' + (dark?.censored ? ' is-censored' : '')}
                x={x + 1} y={ROW - dh} width={Math.max(1, bw - 2)} height={dh} />
              <rect className="arrival-series-earth" x={x + 1} y={2 * ROW + 16 - eh} width={Math.max(1, bw - 2)} height={eh} />
              {sel ? <rect className="arrival-series-marker" x={x} y="14" width={bw} height={2 * ROW + 4} /> : null}
            </g>
          );
        })}
        <text x={LEFT} y={2 * ROW + 32} className="arrival-series-axis">{series[0].date}</text>
        <text x={W} y={2 * ROW + 32} textAnchor="end" className="arrival-series-axis">{series[series.length - 1].date}</text>
      </svg>
      <p className="caption">
        Hatched/outlined darkness bars touch a window edge, so the value is a lower bound (≥). Durations use the 5-minute
        event search refined to at most 1 minute. This shows how conditions change with the date; it does not rank dates
        or points, and it does not size power systems.
      </p>
      <details className="arrival-series-table">
        <summary>Show all {series.length} dates as a table</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Arrival (UTC)</th><th scope="col">Mean visible Sun</th><th scope="col">Longest darkness</th><th scope="col">Earth visible</th><th scope="col"><span className="sr-only">Action</span></th></tr>
            </thead>
            <tbody>
              {series.map(s => (
                <tr key={s.date} aria-current={s.date === selectedDate ? 'true' : undefined}>
                  <th scope="row">{s.date}</th>
                  <td>{percent(s.summary?.meanSun)}</td>
                  <td>{hours(s.summary?.dark)}</td>
                  <td>{percent(s.summary?.earthFraction)}</td>
                  <td>{onSelect ? <button type="button" onClick={() => onSelect(s.date)} disabled={s.date === selectedDate}>Use as arrival</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
