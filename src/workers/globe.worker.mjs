// The same deterministic visual geometry, computed off the interaction thread.
import { displacedGlobe } from "../lib/sceneGeometry.mjs";
self.onmessage = ({ data }) => {
  try {
    const grid = {
      width: data.width,
      height: data.height,
      values: new Int16Array(data.buffer),
    };
    const g = displacedGlobe(grid, data.segments);
    const position = g.attributes.position.array,
      normal = g.attributes.normal.array,
      uv = g.attributes.uv.array,
      index = g.index.array;
    self.postMessage(
      {
        position,
        normal,
        uv,
        index,
        sphere: {
          center: g.boundingSphere.center.toArray(),
          radius: g.boundingSphere.radius,
        },
      },
      [position.buffer, normal.buffer, uv.buffer, index.buffer],
    );
  } catch (error) {
    self.postMessage({ error: String(error.message) });
  }
};
