import { horizonAt } from "../lib/analysis.mjs";
export default function Horizon({ data, index, height }) {
  if (!data)
    return (
      <p>Terrain horizon will appear when the verified dataset is available.</p>
    );
  const values = data.horizon.elevationDeg[String(height)];
  const lo =
      Math.min(-3, ...values, data.sun.elDeg[index], data.earth.elDeg[index]) -
      1,
    hi =
      Math.max(6, ...values, data.sun.elDeg[index], data.earth.elDeg[index]) +
      1;
  const x = (a) => 45 + (a / 360) * 810,
    y = (e) => 190 - ((e - lo) / (hi - lo)) * 165;
  const path = values
    .map((v, i) => `${i ? "L" : "M"}${x((i * 360) / values.length)},${y(v)}`)
    .join(" ");
  const bodies = [
    ["Sun", data.sun, "#ffc978"],
    ["Earth", data.earth, "#62b6ff"],
  ];
  return (
    <div className="horizon-chart">
      <svg
        viewBox="0 0 900 235"
        role="img"
        aria-label="Local terrain horizon and Sun and Earth elevations at the selected time"
      >
        {[0, 90, 180, 270, 360].map((a) => (
          <g key={a}>
            <path d={`M${x(a)} 20V190`} stroke="#29374e" />
            <text x={x(a)} y="215" textAnchor="middle">
              {["N", "E", "S", "W", "N"][a / 90]} · {a}°
            </text>
          </g>
        ))}
        <path d={`M45 ${y(0)}H855`} stroke="#61718a" strokeDasharray="4 5" />
        <text x="45" y="15">
          Elevation relative to local horizontal
        </text>
        <path d={`${path}L855 190H45Z`} fill="#263347" />
        <path d={path} stroke="#b4c1d1" strokeWidth="2" fill="none" />
        {bodies.map(([name, body, color]) => {
          const a = body.azDeg[index],
            e = body.elDeg[index];
          return (
            <g key={name}>
              <circle cx={x(a)} cy={y(e)} r="6" fill={color} />
              <text
                x={Math.min(805, Math.max(60, x(a)))}
                y={Math.max(28, y(e) - 12)}
                fill={color}
              >
                {name} · {e.toFixed(2)}°
              </text>
            </g>
          );
        })}
      </svg>
      <p className="caption">
        Solid line: terrain at {height} m observer height. Dashed line:
        geometric horizon. Sun and Earth discs enlarged as markers here; not
        angular scale.
      </p>
      <p className="caption">
        Terrain elevation at the Sun's azimuth:{" "}
        {horizonAt(values, data.sun.azDeg[index]).toFixed(2)}°.
      </p>
    </div>
  );
}
