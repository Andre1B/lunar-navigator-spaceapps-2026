// Same explicit angular-circle approximation as scientific/lunar_eclipse.py.
// Uniform Sun, opaque spherical Earth, horizontal terrain cut; not irradiance.
import { visibleDiskFraction } from "./analysis.mjs";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
let quadrature;
function gauss128() {
  if (quadrature) return quadrature;
  const nodes = [],
    weights = [],
    n = 128;
  for (let i = 0; i < n / 2; i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)),
      derivative;
    for (let iteration = 0; iteration < 20; iteration++) {
      let p = 1,
        previous = 0;
      for (let j = 1; j <= n; j++) {
        const old = p;
        p = ((2 * j - 1) * z * p - (j - 1) * previous) / j;
        previous = old;
      }
      derivative = (n * (z * p - previous)) / (z * z - 1);
      const next = z - p / derivative;
      if (Math.abs(next - z) < 1e-15) {
        z = next;
        break;
      }
      z = next;
    }
    const weight = 2 / ((1 - z * z) * derivative * derivative);
    nodes[i] = -z;
    nodes[n - 1 - i] = z;
    weights[i] = weights[n - 1 - i] = weight;
  }
  quadrature = { nodes, weights };
  return quadrature;
}
export function circleOverlapFraction(r, R, d) {
  if (![r, R, d].every(Number.isFinite) || r <= 0 || R <= 0 || d < 0)
    return null;
  if (d >= r + R) return 0;
  if (d <= Math.abs(R - r)) return Math.min(r, R) ** 2 / r ** 2;
  const a = Math.acos(clamp((d * d + r * r - R * R) / (2 * d * r), -1, 1));
  const b = Math.acos(clamp((d * d + R * R - r * r) / (2 * d * R), -1, 1));
  const q = (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R);
  return (
    (r * r * a + R * R * b - 0.5 * Math.sqrt(Math.max(q, 0))) /
    (Math.PI * r * r)
  );
}
export function solarVisibleFraction(r, R, cx, cy, h) {
  if (![r, R, cx, cy, h].every(Number.isFinite) || r <= 0 || R <= 0)
    return null;
  const d = Math.hypot(cx, cy);
  if (h >= r || d + r <= R) return 0;
  if (h <= -r) return Math.max(0, 1 - circleOverlapFraction(r, R, d));
  // Earth can cover the entire terrain-visible cap without covering all the Sun.
  const farthestY = d > 0 ? (-r * cy) / d : r;
  const capDistance =
    farthestY >= h
      ? d + r
      : Math.hypot(
          Math.abs(cx) + Math.sqrt(Math.max(0, r * r - h * h)),
          h - cy,
        );
  if (capDistance <= R) return 0;
  const terrain = visibleDiskFraction(0, h, r);
  if (d >= r + R) return terrain;
  if (d + R <= r) {
    const q = clamp((cy - h) / R, -1, 1);
    const covered = R * R * (Math.PI - Math.acos(q) + q * Math.sqrt(1 - q * q));
    return clamp(terrain - covered / (Math.PI * r * r), 0, terrain);
  }
  const lo = Math.max(h, -r, cy - R),
    hi = Math.min(r, cy + R);
  if (lo >= hi) return terrain;
  const breaks = [lo, hi];
  if (Math.abs(r - R) < d && d < r + R) {
    const a = (r * r - R * R + d * d) / (2 * d),
      b = Math.sqrt(Math.max(0, r * r - a * a));
    breaks.push((a * cy) / d - (b * cx) / d, (a * cy) / d + (b * cx) / d);
  }
  const sorted = [...new Set(breaks.filter((y) => y >= lo && y <= hi))].sort(
    (a, b) => a - b,
  );
  const { nodes, weights } = gauss128();
  let blocked = 0;
  for (let part = 1; part < sorted.length; part++) {
    const a = sorted[part - 1],
      b = sorted[part],
      scale = (b - a) * 0.5,
      middle = (a + b) * 0.5;
    let sum = 0;
    for (let i = 0; i < nodes.length; i++) {
      const y = scale * nodes[i] + middle,
        sx = Math.sqrt(Math.max(0, r * r - y * y)),
        ex = Math.sqrt(Math.max(0, R * R - (y - cy) ** 2));
      sum +=
        weights[i] *
        Math.max(0, Math.min(sx, cx + ex) - Math.max(-sx, cx - ex));
    }
    blocked += scale * sum;
  }
  return clamp(terrain - blocked / (Math.PI * r * r), 0, terrain);
}
export function solarObservation(sun, earth) {
  const r = sun.angularRadiusDeg,
    R = earth.angularRadiusDeg;
  if (
    ![
      r,
      R,
      sun.azimuthDeg,
      sun.elevationDeg,
      earth.azimuthDeg,
      earth.elevationDeg,
      sun.horizonDeg,
    ].every(Number.isFinite)
  )
    return null;
  const rad = Math.PI / 180,
    sa = sun.azimuthDeg * rad,
    se = sun.elevationDeg * rad,
    ea = earth.azimuthDeg * rad,
    ee = earth.elevationDeg * rad;
  const sx = Math.cos(se) * Math.cos(sa),
    sy = Math.cos(se) * Math.sin(sa),
    sz = Math.sin(se);
  const ex = Math.cos(ee) * Math.cos(ea),
    ey = Math.cos(ee) * Math.sin(ea),
    ez = Math.sin(ee);
  const x = -ex * Math.sin(sa) + ey * Math.cos(sa);
  const y =
    -ex * Math.sin(se) * Math.cos(sa) -
    ey * Math.sin(se) * Math.sin(sa) +
    ez * Math.cos(se);
  const rho = Math.hypot(x, y),
    separation = Math.atan2(rho, sx * ex + sy * ey + sz * ez) / rad;
  if (separation >= r + R)
    return { fraction: sun.fraction, unobscuredFraction: 1, eclipse: false };
  const scale = rho > 1e-15 ? separation / rho : 1;
  return {
    fraction: solarVisibleFraction(
      r,
      R,
      x * scale,
      y * scale,
      sun.horizonDeg - sun.elevationDeg,
    ),
    unobscuredFraction: 1 - circleOverlapFraction(r, R, separation),
    eclipse: true,
  };
}
