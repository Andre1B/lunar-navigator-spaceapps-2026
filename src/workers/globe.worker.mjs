// The same deterministic visual geometry, computed off the interaction thread.
import { displacedGlobe } from "../lib/sceneGeometry.mjs";
self.onmessage = ({ data }) => {
  try {
    const grid = {
      width: data.width,
      height: data.height,
      values: new Int16Array(data.buffer),
    };
    // One or more levels of detail; all are built here, off the main thread.
    const meshes = [].concat(data.segments).map((segments) => {
      const g = displacedGlobe(grid, segments);
      return {
        position: g.attributes.position.array,
        normal: g.attributes.normal.array,
        uv: g.attributes.uv.array,
        index: g.index.array,
        sphere: {
          center: g.boundingSphere.center.toArray(),
          radius: g.boundingSphere.radius,
        },
      };
    });
    self.postMessage(
      { meshes },
      meshes.flatMap((m) => [
        m.position.buffer,
        m.normal.buffer,
        m.uv.buffer,
        m.index.buffer,
      ]),
    );
  } catch (error) {
    self.postMessage({ error: String(error.message) });
  }
};
