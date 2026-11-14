// AI-assisted geometry implementation. Source values are deterministic NASA data.
import * as THREE from "three";
export const MOON_RADIUS_M = 1737400;
const cache = new Map();
export function readJson(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw Error("Visual data unavailable: " + url);
        return r.json();
      }),
    );
  return cache.get(url);
}
export function readGrid(url, width, height) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw Error("Terrain unavailable: " + url);
          return r.arrayBuffer();
        })
        .then((buffer) => {
          if (buffer.byteLength !== width * height * 2)
            throw Error("Unexpected elevation grid size");
          const view = new DataView(buffer),
            values = new Int16Array(width * height);
          for (let i = 0; i < values.length; i++)
            values[i] = view.getInt16(i * 2, true);
          return { values, width, height };
        }),
    );
  return cache.get(url);
}
export function sampleGrid(grid, col, row, wrap = false) {
  const { width: w, height: h, values } = grid;
  const rx = wrap ? ((col % w) + w) % w : Math.max(0, Math.min(w - 1, col)),
    ry = Math.max(0, Math.min(h - 1, row));
  const x0 = Math.floor(rx),
    y0 = Math.floor(ry),
    x1 = wrap ? (x0 + 1) % w : Math.min(w - 1, x0 + 1),
    y1 = Math.min(h - 1, y0 + 1),
    dx = rx - x0,
    dy = ry - y0;
  return (
    (values[y0 * w + x0] * (1 - dx) + values[y0 * w + x1] * dx) * (1 - dy) +
    (values[y1 * w + x0] * (1 - dx) + values[y1 * w + x1] * dx) * dy
  );
}
export function displacedGlobe(grid, segments = 360) {
  const g = new THREE.SphereGeometry(1, segments, segments / 2),
    p = g.attributes.position,
    uv = g.attributes.uv,
    v = new THREE.Vector3();
  // Longitude is undefined at each pole: duplicate vertices must share a radius.
  const poleMean = (row) => {
    let sum = 0;
    for (let c = 0; c < grid.width; c++)
      sum += grid.values[row * grid.width + c];
    return sum / grid.width;
  };
  const north = poleMean(0),
    south = poleMean(grid.height - 1);
  for (let i = 0; i < p.count; i++) {
    const height =
      uv.getY(i) === 1
        ? north
        : uv.getY(i) === 0
          ? south
          : sampleGrid(
              grid,
              uv.getX(i) * grid.width - 0.5,
              (1 - uv.getY(i)) * grid.height - 0.5,
              true,
            );
    v.fromBufferAttribute(p, i)
      .normalize()
      .multiplyScalar(1 + height / MOON_RADIUS_M);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  // Uniform physical baselines avoid ill-conditioned, needle-thin polar triangles.
  // The baseline is the north/south source-cell spacing, not an artistic exaggeration.
  const normal = g.attributes.normal,
    U = new THREE.Vector3(),
    E = new THREE.Vector3(),
    N = new THREE.Vector3(),
    d = new THREE.Vector3();
  const angle = Math.PI / grid.height,
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  const elevation = (direction) =>
    sampleGrid(
      grid,
      (Math.atan2(-direction.z, direction.x) / (2 * Math.PI) + 0.5) *
        grid.width -
        0.5,
      (0.5 - Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) / Math.PI) *
        grid.height -
        0.5,
      true,
    );
  const slope = (axis) => {
    const plus = elevation(
      d.copy(U).multiplyScalar(cs).addScaledVector(axis, sn),
    );
    const minus = elevation(
      d.copy(U).multiplyScalar(cs).addScaledVector(axis, -sn),
    );
    return (plus - minus) / (2 * MOON_RADIUS_M * sn);
  };
  for (let i = 0; i < p.count; i++) {
    U.fromBufferAttribute(p, i).normalize();
    E.set(0, 1, 0).cross(U);
    if (E.lengthSq() < 1e-12) E.set(1, 0, 0);
    E.normalize();
    N.copy(U).cross(E).normalize();
    const eastSlope = slope(E),
      northSlope = slope(N);
    v.copy(U)
      .addScaledVector(E, -eastSlope)
      .addScaledVector(N, -northSlope)
      .normalize();
    normal.setXYZ(i, v.x, v.y, v.z);
  }
  normal.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}
export function polarPoint(x, y, heightM = 0) {
  const lat =
      -Math.PI / 2 + 2 * Math.atan(Math.hypot(x, y) / (2 * MOON_RADIUS_M)),
    lon = Math.atan2(x, y),
    r = 1 + heightM / MOON_RADIUS_M;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon),
  );
}
export function localTerrain(grid, tile, segments = 250) {
  const count = segments + 1,
    positions = new Float32Array(count * count * 3),
    uv = new Float32Array(count * count * 2),
    indices = [];
  const b = tile.boundsPolarStereoM;
  for (let r = 0; r < count; r++)
    for (let c = 0; c < count; c++) {
      const x = b.xMin + (c / segments) * (b.xMax - b.xMin),
        y = b.yMax - (r / segments) * (b.yMax - b.yMin);
      const z = sampleGrid(
          grid,
          (c / segments) * grid.width - 0.5,
          (r / segments) * grid.height - 0.5,
        ),
        v = polarPoint(x, y, z),
        i = r * count + c;
      positions.set(v.toArray(), i * 3);
      const lon = Math.atan2(x, y),
        lat =
          -Math.PI / 2 + 2 * Math.atan(Math.hypot(x, y) / (2 * MOON_RADIUS_M));
      uv.set(
        [(lon + Math.PI) / (2 * Math.PI), (lat + Math.PI / 2) / Math.PI],
        i * 2,
      );
      if (r < segments && c < segments) {
        const a = i,
          d = i + count;
        indices.push(a, a + 1, d, a + 1, d + 1, d);
      }
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  // Projection winding differs from a flat north-up map; require outward normals.
  const normal = new THREE.Vector3().fromBufferAttribute(
      g.attributes.normal,
      Math.floor(g.attributes.normal.count / 2),
    ),
    out = new THREE.Vector3().fromBufferAttribute(
      g.attributes.position,
      Math.floor(g.attributes.position.count / 2),
    );
  if (normal.dot(out) < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
  return g;
}
export function interpolateVector(array, index, target = new THREE.Vector3()) {
  const i = Math.max(0, Math.min(array.length - 1, Math.floor(index))),
    j = Math.min(i + 1, array.length - 1),
    f = Math.max(0, Math.min(1, index - i));
  return target.set(
    array[i][0] * (1 - f) + array[j][0] * f,
    array[i][2] * (1 - f) + array[j][2] * f,
    -array[i][1] * (1 - f) - array[j][1] * f,
  );
}
export function interpolateBodyQuaternion(
  array,
  index,
  target = new THREE.Quaternion(),
) {
  const i = Math.max(0, Math.min(array.length - 1, Math.floor(index))),
    j = Math.min(i + 1, array.length - 1),
    f = Math.max(0, Math.min(1, index - i));
  const a = array[i],
    b = array[j];
  target.set(-a[1], -a[3], a[2], a[0]);
  return target.slerp(new THREE.Quaternion(-b[1], -b[3], b[2], b[0]), f);
}
