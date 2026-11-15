// Original visualization code. This adds no scientific samples or terrain data.
import * as THREE from "three";
import { MOON_RADIUS_M } from "./sceneGeometry.mjs";

// `role` splits the foreground: "near" (the 5 m patch) is cut away outside
// patchRadius and "far" (the 40 m tile) inside patchRadius - 40 m. The 40 m
// overlap band lets depth testing close any height step at the seam. Both share uniforms so the
// numerical horizon clip is identical. Pass `shared` to reuse another
// material's uniforms and horizon texture.
export function surfaceMaterial({ role = "far", shared = null } = {}) {
  let horizon = shared?.horizon;
  if (!horizon) {
    horizon = new THREE.DataTexture(
      new Float32Array(720),
      720,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    horizon.minFilter = horizon.magFilter = THREE.NearestFilter;
    horizon.needsUpdate = true;
  }
  const uniforms = shared?.uniforms ?? {
    surfaceHorizon: { value: horizon },
    surfaceObserver: { value: new THREE.Vector3() },
    surfaceAlignment: { value: new THREE.Vector3() },
    surfaceEast: { value: new THREE.Vector3() },
    surfaceNorth: { value: new THREE.Vector3() },
    surfaceUp: { value: new THREE.Vector3() },
    patchRadius: { value: 0 },
  };
  // Each mesh keeps its own radial alignment under the observer.
  const own = new THREE.Vector3();
  const material = new THREE.MeshStandardMaterial({
    color: "#aaa69e",
    roughness: 1,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.ownAlignment = { value: own };
    shader.vertexShader =
      `uniform vec3 surfaceObserver; uniform vec3 ownAlignment;
      varying vec3 surfaceRay; varying vec3 surfacePosition;\n` +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      surfaceRay = (position + ownAlignment - surfaceObserver) * ${MOON_RADIUS_M.toFixed(1)};
      surfacePosition = position * ${MOON_RADIUS_M.toFixed(1)};`,
    );
    shader.fragmentShader =
      `uniform sampler2D surfaceHorizon; uniform vec3 surfaceEast; uniform float patchRadius;
      uniform vec3 surfaceNorth; uniform vec3 surfaceUp;
      varying vec3 surfaceRay; varying vec3 surfacePosition;\n` +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `#include <clipping_planes_fragment>
      vec3 ray = normalize(surfaceRay);
      float phase = fract(atan(dot(ray,surfaceEast),dot(ray,surfaceNorth))/6.28318530718+1.0)*720.0;
      float cell = floor(phase);
      float h0 = texture2D(surfaceHorizon,vec2((cell+0.5)/720.0,0.5)).r;
      float h1 = texture2D(surfaceHorizon,vec2((mod(cell+1.0,720.0)+0.5)/720.0,0.5)).r;
      float limit = mix(h0,h1,fract(phase));
      float elevation = asin(clamp(dot(ray,surfaceUp),-1.0,1.0));
      // Numerical horizon is authoritative: foreground cannot cover open sky.
      if(elevation > limit) discard;
      float across = length(surfaceRay - dot(surfaceRay, surfaceUp) * surfaceUp);
      ${role === "near" ? "if(across > patchRadius) discard;" : "if(patchRadius > 0.0 && across < patchRadius - 40.0) discard;"}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      // Fine albedo grain is illustrative, NOT new rocks or elevation data.
      float footprint=max(length(dFdx(surfacePosition)),length(dFdy(surfacePosition)));
      float detail=1.0-smoothstep(0.02,0.15,footprint);
      float grain=fract(sin(dot(floor(surfacePosition*8.0),vec3(12.9898,78.233,37.719)))*43758.5453);
      diffuseColor.rgb *= 1.0-0.06*detail*(1.0-grain);`,
    );
  };
  material.customProgramCacheKey = () =>
    "numerical-horizon-clipped-regolith-v2-" + role;
  return { material, horizon, uniforms, alignment: own };
}

// Align the actual rendered triangle under the observer, rather than a nearest
// raster cell. Uniform radial translation preserves the measured local slopes.
export function alignSurfaceAtObserver(geometry, bodyGround, up) {
  geometry.computeBoundingSphere();
  const probe = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  const ray = new THREE.Raycaster(
    bodyGround.clone().addScaledVector(up, 0.1),
    up.clone().negate(),
    0,
    0.2,
  );
  const hit = ray.intersectObject(probe, false)[0];
  probe.material.dispose();
  return hit ? bodyGround.clone().sub(hit.point).dot(up) : null;
}
