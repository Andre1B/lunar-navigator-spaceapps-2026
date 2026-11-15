// Data-driven explanatory rendering. Scientific outputs remain in sites/*.json.
// AI assistance and third-party provenance: /ai-use.json, Credits and data manifests.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { horizonAt, visibleDiskFraction } from "../lib/analysis.mjs";
import { solarObservation } from "../lib/solarVisibility.mjs";
import {
  createPresentationAnchor,
  samplePresentation,
} from "../lib/presentationClock.mjs";
import {
  surfaceMaterial,
  alignSurfaceAtObserver,
} from "../lib/surfaceVisual.mjs";
import {
  readJson,
  readGrid,
  displacedGlobe,
  localTerrain,
  MOON_RADIUS_M,
  interpolateVector,
  interpolateBodyQuaternion,
  sampleGrid,
} from "../lib/sceneGeometry.mjs";

// Short facts shown while a planet is inspected. Moons are listed only:
// their positions are not part of the computed dataset and are not drawn.
const PLANET_NOTES = {
  jupiter:
    "Jupiter: banded cloud tops, the Great Red Spot. Its four large moons, Io, Europa, Ganymede and Callisto, are not drawn here because their positions are not in this dataset (NASA: science.nasa.gov/jupiter/jupiter-moons).",
  saturn:
    "Saturn: main rings drawn from 1.24 to 2.27 Saturn radii in its equatorial plane; the ring tilt shown is illustrative.",
  sun: "Sun: surface texture is illustrative; rotation uses the 25.4-day sidereal period.",
  earth:
    "Earth: daytime imagery with an illustrative, slowly drifting cloud layer, not current weather.",
};

export default function SpaceSceneV2({
  sky,
  planets,
  index,
  freeze = {},
  view = "overview",
  site,
  siteData,
  height = 1,
  onViewChange,
  onFocusChange,
  onObservation,
  surfaceStyle = "terrain",
  lightPaths = false,
  opticalGlare = true,
  enhancedVision = false,
  detailedShadows = false,
  playing = false,
  speed = 6,
}) {
  const presentation = useRef(null);
  if (
    !presentation.current ||
    presentation.current.index !== index ||
    presentation.current.playing !== playing ||
    presentation.current.speed !== speed
  )
    presentation.current = createPresentationAnchor(
      presentation.current,
      index,
      playing,
      speed,
      performance.now(),
    );
  const host = useRef(null),
    engine = useRef(null),
    latest = useRef({
      sky,
      planets,
      index,
      freeze,
      view,
      site,
      siteData,
      height,
      onViewChange,
      onFocusChange,
      onObservation,
    });
  latest.current = {
    surfaceStyle,
    lightPaths,
    opticalGlare,
    enhancedVision,
    detailedShadows,
    playing,
    speed,
    sky,
    planets,
    index,
    freeze,
    view,
    site,
    siteData,
    height,
    onViewChange,
    onFocusChange,
    onObservation,
  };
  const [status, setStatus] = useState("Loading lunar imagery and elevation…"),
    [error, setError] = useState(null),
    [following, setFollowing] = useState(null);
  const labels = useRef({});
  useEffect(() => {
    const el = host.current,
      mobile =
        matchMedia("(max-width:720px)").matches ||
        (matchMedia("(pointer:coarse)").matches &&
          !matchMedia("(hover:hover)").matches),
      reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const qaMode = new URLSearchParams(location.search).has("qa");
    let disposed = false,
      frame = 0,
      renderer,
      globeWorker,
      previousKey = "",
      terrainSite = "",
      terrainLoading = "",
      wallKey = "",
      transition = null,
      skyDrag = null,
      localCameraBody = null,
      localTargetBody = null,
      trackedBody = "moon",
      previousTrackedPosition = new THREE.Vector3(),
      settingCamera = false;
    let shadersReady = false,
      preparingShaders = false,
      imageryReady = false,
      globeReady = false,
      uploadFrame = 0;
    let pendingFocus = null;
    let observationKey = "",
      currentObservation = null,
      lastRendered = null;
    let wantsFrame = false;
    let frameCredit = 1,
      lastFrameAt = -Infinity,
      lastObservationAt = -Infinity,
      lastPublishedObservationKey = "",
      lastPublishedContext = "";
    const frameInterval = 1000 / (mobile ? 60 : 120);
    let terrainGrid = null,
      terrainTile = null,
      surfaceAnchorSite = "",
      surfaceAlignmentM = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "Your device cannot open the 3D view. The comparison, tutorial and evidence remain available.",
      );
      return;
    }
    const basePixelRatio = Math.min(devicePixelRatio, mobile ? 1.25 : 1.5);
    renderer.setPixelRatio(basePixelRatio);
    // Adaptive resolution: when the GPU cannot hold a smooth frame rate, draw
    // fewer pixels. Only sharpness changes; geometry, data, occlusion and the
    // shared clock are untouched. Measured between consecutive drawn frames.
    let renderScale = 1,
      continuousLoop = false,
      prevDrawAt = null,
      slowFrames = 0,
      fastFrames = 0,
      failedScaleAt = -Infinity,
      failedScale = 2;
    function adaptResolution(now) {
      const dt = prevDrawAt === null ? null : now - prevDrawAt;
      prevDrawAt = now;
      // Only frames of a continuous loop (Play or a camera transition) measure
      // rendering cost; on-demand draws follow input cadence, not the GPU.
      if (!continuousLoop) {
        slowFrames = 0;
        fastFrames = 0;
        return;
      }
      // Gaps longer than 400 ms are idle time, not rendering cost.
      if (dt === null || dt > 400) return;
      if (dt > 26) {
        slowFrames++;
        fastFrames = 0;
      } else if (dt < 19.5) {
        fastFrames++;
        slowFrames = 0;
      } else {
        slowFrames = 0;
        fastFrames = 0;
      }
      let next = renderScale;
      // Still too slow at the lowest resolution: use a coarser visual mesh for
      // the local terrain. Numerical horizons and alignment use the full mesh.
      if (
        slowFrames >= 6 &&
        renderScale <= 0.45 &&
        terrainDetail === "full" &&
        terrainGrid &&
        terrainFull
      ) {
        terrainDetail = "low";
        terrainLow = localTerrain(terrainGrid, terrainTile, 120);
        terrain.geometry = terrainLow;
        surfaceTerrain.geometry = terrainLow;
        slowFrames = 0;
        return;
      }
      if (slowFrames >= 6 && renderScale > 0.45) {
        failedScale = renderScale;
        failedScaleAt = now;
        next = Math.max(0.45, renderScale * 0.75);
      } else if (
        fastFrames >= 90 &&
        renderScale < 1 &&
        // A scale that was too slow is never retried in this session:
        // retrying flashed and stalled the canvas on weaker GPUs.
        renderScale * 1.2 < failedScale
      )
        next = Math.min(1, renderScale * 1.2);
      if (next !== renderScale) {
        renderScale = next;
        slowFrames = 0;
        fastFrames = 0;
        renderer.setPixelRatio(basePixelRatio * renderScale);
        renderer.setSize(el.clientWidth, el.clientHeight, false);
      }
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#030811");
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Lunar 3D explorer. Drag to look around. Named camera presets and keyboard camera controls are available.",
    );
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight ArrowUp ArrowDown + - Home",
    );
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(45, 1, 1e-7, 1e8),
      renderCamera = camera.clone();
    camera.position.set(0, 1, 3);
    camera.layers.enable(1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 1.03;
    controls.maxDistance = 1e7;
    controls.enablePan = false;
    function updateOrbit() {
      // Three 0.187 caches the orbit basis at construction. Our local lunar up
      // rotates with time, so refresh that basis before applying orbit constraints.
      controls._quat.setFromUnitVectors(
        camera.up.clone().normalize(),
        new THREE.Vector3(0, 1, 0),
      );
      controls._quatInverse.copy(controls._quat).invert();
      controls.update();
    }
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    THREE.Cache.enabled = true;
    const moonMap = loader.load(
      "/data/globe/moon-color-lroc-" +
        (mobile ? "1024x512" : "2048x1024") +
        ".jpg",
      schedule,
    );
    moonMap.colorSpace = THREE.SRGBColorSpace;
    moonMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const earthMap = loader.load(
      "/data/globe/earth-visual-" + (mobile ? "1k" : "2k") + ".jpg",
      schedule,
    );
    earthMap.colorSpace = THREE.SRGBColorSpace;
    earthMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const oceanMap = loader.load(
      "/data/globe/earth-ocean-specular-" + (mobile ? "1k" : "2k") + ".jpg",
      schedule,
    );
    const cloudMap = loader.load(
      "/data/globe/earth-clouds-illustrative-" +
        (mobile ? "1k" : "2k") +
        ".jpg",
      schedule,
    );
    const starsMap = loader.load(
      "/data/starmap/starmap-2020-celestial-" +
        (mobile ? "1024x512" : "2048x1024") +
        ".jpg",
      schedule,
    );
    starsMap.colorSpace = THREE.SRGBColorSpace;
    starsMap.wrapS = THREE.RepeatWrapping;
    starsMap.repeat.x = -1;
    starsMap.offset.x = 1;
    manager.onLoad = () => {
      // Spread texture uploads over frames rather than blocking one large first
      // draw. These are real preparation steps, with no artificial loading delay.
      const textures = [moonMap, earthMap, oceanMap, cloudMap, starsMap];
      let next = 0;
      const upload = () => {
        if (disposed) return;
        const texture = textures[next++];
        if (texture?.image) renderer.initTexture(texture);
        if (next < textures.length) uploadFrame = requestAnimationFrame(upload);
        else {
          imageryReady = true;
          if (globeReady) setStatus("");
          schedule();
        }
      };
      uploadFrame = requestAnimationFrame(upload);
    };
    // Desktop starts with 2k imagery: at the default framing the visible globe is not
    // larger than a 2k map. The same texture objects switch to 4k on the first scene
    // interaction (drag, wheel, keys, camera buttons), when closer inspection begins.
    let imageryUpgraded = mobile;
    const upgradeImagery = () => {
      if (imageryUpgraded) return;
      imageryUpgraded = true;
      const imageLoader = new THREE.ImageLoader();
      for (const [texture, url] of [
        [moonMap, "/data/globe/moon-color-lroc-4096x2048.jpg"],
        [earthMap, "/data/globe/earth-visual-4k.jpg"],
        [starsMap, "/data/starmap/starmap-2020-celestial-4096x2048.jpg"],
      ])
        imageLoader.load(url, (image) => {
          if (disposed) return;
          texture.image = image;
          texture.needsUpdate = true;
          schedule();
        });
    };
    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(5e7, 48, 24),
      new THREE.MeshBasicMaterial({
        map: starsMap,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        color: "#272e3b",
      }),
    );
    stars.renderOrder = -10;
    scene.add(stars);
    const lunarMaterial = new THREE.MeshStandardMaterial({
      map: moonMap,
      roughness: 0.96,
      metalness: 0,
    });
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 64),
      lunarMaterial,
    );
    moon.castShadow = true;
    // Global shadow-map texels cannot resolve grazing illumination at the poles.
    // Use physical surface normals here; local terrain has its own tight shadow map.
    moon.receiveShadow = false;
    scene.add(moon);
    // A separate illustrative outline; the physical Moon mesh stays unchanged.
    const moonOutline = new THREE.Mesh(
      moon.geometry,
      new THREE.MeshBasicMaterial({
        color: "#f2b544",
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    moonOutline.scale.setScalar(1.0018);
    scene.add(moonOutline);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 80),
      new THREE.MeshPhongMaterial({
        map: earthMap,
        specularMap: oceanMap,
        shininess: 35,
        specular: "#30465a",
      }),
    );
    scene.add(earth);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 80),
      new THREE.MeshPhongMaterial({
        color: "#ffffff",
        alphaMap: cloudMap,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
        shininess: 2,
      }),
    );
    scene.add(clouds);
    // A thin illustrative atmosphere; the solid body's physical radius is unchanged.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 80, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { sunDirection: { value: new THREE.Vector3(1, 0, 0) } },
        vertexShader: `varying vec3 n; varying vec3 eye; varying vec3 worldN;
        void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); eye=normalize(-p.xyz); worldN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*p;}`,
        fragmentShader: `uniform vec3 sunDirection; varying vec3 n; varying vec3 eye; varying vec3 worldN;
        void main(){float rim=pow(1.0-max(dot(normalize(n),normalize(eye)),0.0),3.5);
        float daylight=smoothstep(-0.18,0.35,dot(normalize(worldN),sunDirection));
        gl_FragColor=vec4(0.10,0.35,0.85,(0.10+rim*0.45)*daylight);}`,
      }),
    );
    scene.add(atmosphere);
    // Appearance textures (Solar System Scope, CC BY 4.0) load on their own
    // loader so they never delay the scene; positions and sizes are unchanged.
    const appearance = new THREE.TextureLoader();
    const skin = (name) => {
      const t = appearance.load(`/assets/planets/${name}.jpg`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.MeshBasicMaterial({
        color: "#fff0bd",
        map: skin("sun"),
        toneMapped: false,
      }),
    );
    scene.add(sun);
    // Sidereal rotation periods in hours (IAU WGCCRE; negative = retrograde).
    // Rotation follows simulation time; the spin axis is illustrative.
    const ROTATION_H = {
      sun: 609.12,
      mercury: 1407.6,
      venus: -5832.5,
      mars: 24.623,
      jupiter: 9.925,
      saturn: 10.656,
      uranus: -17.24,
      neptune: 16.11,
    };
    // One inexpensive glare sprite, not ray tracing or visible beams through vacuum.
    const glareCanvas = document.createElement("canvas");
    glareCanvas.width = glareCanvas.height = 256;
    const ctx = glareCanvas.getContext("2d"),
      glow = ctx.createRadialGradient(128, 128, 2, 128, 128, 124);
    glow.addColorStop(0, "rgba(255,249,221,0.8)");
    glow.addColorStop(0.12, "rgba(255,225,151,0.3)");
    glow.addColorStop(0.5, "rgba(255,195,91,0.04)");
    glow.addColorStop(1, "rgba(255,190,80,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      ctx.save();
      ctx.translate(128, 128);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 120, 0);
      g.addColorStop(0, "rgba(255,240,196,0.24)");
      g.addColorStop(1, "rgba(255,240,196,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, -0.6, 120, 1.2);
      ctx.restore();
    }
    const glareTexture = new THREE.CanvasTexture(glareCanvas);
    const glare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glareTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    scene.add(glare);
    const terrain = new THREE.Mesh(new THREE.BufferGeometry(), lunarMaterial);
    terrain.layers.set(1);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    const wall = new THREE.Mesh(
      new THREE.BufferGeometry(),
      // Angular occlusion mask: neutral grey is NOT a surface-lighting model.
      new THREE.MeshBasicMaterial({
        color: "#697481",
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    scene.add(wall);
    const horizonOutline = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#f2b544",
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    horizonOutline.layers.set(2);
    horizonOutline.frustumCulled = false;
    scene.add(horizonOutline);
    const terrainOutline = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#f2b544",
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    terrainOutline.renderOrder = 1000;
    scene.add(terrainOutline);
    const surface = surfaceMaterial();
    const surfaceTerrain = new THREE.Mesh(terrain.geometry, surface.material);
    surfaceTerrain.layers.set(1);
    surfaceTerrain.castShadow = surfaceTerrain.receiveShadow = true;
    scene.add(surfaceTerrain);
    // Surface sky foreground: a 5 m patch of the same PGDA DEM around the
    // observer replaces the 40 m tile within NEAR_RADIUS_M. Visual only; the
    // numerical horizon still clips both and decides every visibility value.
    const NEAR_HALF_M = 400,
      NEAR_RADIUS_M = 380;
    const nearSurface = surfaceMaterial({ role: "near", shared: surface });
    const nearTerrain = new THREE.Mesh(
      new THREE.BufferGeometry(),
      nearSurface.material,
    );
    nearTerrain.layers.set(1);
    nearTerrain.castShadow = nearTerrain.receiveShadow = true;
    nearTerrain.visible = false;
    scene.add(nearTerrain);
    let nearSite = "",
      nearLoading = "",
      nearAnchorSite = "",
      nearAlignmentM = null;
    // Between 300 m and the cut at NEAR_RADIUS_M, ease the 5 m heights onto the
    // 40 m mesh surface (its own vertex lattice and alignment), so both
    // foregrounds meet at the same height where one hands over to the other.
    function morphNearSeam(g) {
      const meta = g.userData.near;
      if (!meta || !terrainGrid || !terrainTile) return;
      const T = terrainTile.boundsPolarStereoM,
        seg = mobile ? 160 : 300,
        node = (i, j) =>
          sampleGrid(
            terrainGrid,
            (Math.min(seg, Math.max(0, i)) / seg) * terrainGrid.width - 0.5,
            (Math.min(seg, Math.max(0, j)) / seg) * terrainGrid.height - 0.5,
          );
      const shift = (surfaceAlignmentM ?? 0) - (nearAlignmentM ?? 0);
      const pos = g.attributes.position,
        count = meta.cells + 1,
        P = new THREE.Vector3();
      for (let r = 0; r < count; r++)
        for (let c = 0; c < count; c++) {
          const x = meta.xMin + (c / meta.cells) * meta.span,
            y = meta.yMax - (r / meta.cells) * meta.span,
            d = Math.hypot(x - meta.site[0], y - meta.site[1]);
          if (d <= 300) continue;
          const t = Math.min(1, (d - 300) / (NEAR_RADIUS_M - 300)),
            w = t * t * (3 - 2 * t);
          const u = ((x - T.xMin) / (T.xMax - T.xMin)) * seg,
            v = ((T.yMax - y) / (T.yMax - T.yMin)) * seg,
            i0 = Math.floor(u),
            j0 = Math.floor(v),
            fu = u - i0,
            fv = v - j0;
          // Same triangles as localTerrain: (a, a+1, d) and (a+1, d+1, d),
          // split by the diagonal from (i+1, j) to (i, j+1).
          const h00 = node(i0, j0),
            h10 = node(i0 + 1, j0),
            h01 = node(i0, j0 + 1),
            h11 = node(i0 + 1, j0 + 1);
          const far =
            fu + fv <= 1
              ? h00 + fu * (h10 - h00) + fv * (h01 - h00)
              : h11 + (1 - fu) * (h01 - h11) + (1 - fv) * (h10 - h11);
          const k = r * count + c;
          P.fromBufferAttribute(pos, k);
          const old = (P.length() - 1) * MOON_RADIUS_M,
            next = (1 - w) * old + w * (far + shift);
          P.multiplyScalar((1 + next / MOON_RADIUS_M) / (1 + old / MOON_RADIUS_M));
          pos.setXYZ(k, P.x, P.y, P.z);
        }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }
    function loadNear(id) {
      if (nearLoading === id || nearSite === id) return;
      nearLoading = id;
      readJson("/data/terrain/near.json")
        .then((meta) => {
          const patch = meta.patches.find((t) => t.siteId === id);
          if (!patch) throw Error("No near patch");
          return readGrid("/data/" + patch.file, patch.width, patch.height).then(
            (grid) => ({ grid, patch }),
          );
        })
        .then(({ grid, patch }) => {
          if (disposed || latest.current.site?.id !== id) return;
          // Central NEAR_HALF_M square, decimetres -> metres above the sphere.
          const cells = Math.round((2 * NEAR_HALF_M) / patch.cellSizeM),
            first = Math.round((patch.width - cells) / 2),
            values = new Float32Array(cells * cells);
          for (let r = 0; r < cells; r++)
            for (let c = 0; c < cells; c++)
              values[r * cells + c] =
                patch.baseHeightM +
                grid.values[(first + r) * patch.width + first + c] / 10;
          const b = patch.boundsPolarStereoM,
            off = first * patch.cellSizeM,
            span = cells * patch.cellSizeM;
          const g = localTerrain(
            { values, width: cells, height: cells },
            {
              boundsPolarStereoM: {
                xMin: b.xMin + off,
                xMax: b.xMin + off + span,
                yMax: b.yMax - off,
                yMin: b.yMax - off - span,
              },
            },
            cells,
          );
          g.userData.near = {
            cells,
            xMin: b.xMin + off,
            yMax: b.yMax - off,
            span,
            site: patch.siteXYM,
          };
          nearTerrain.geometry.dispose();
          nearTerrain.geometry = g;
          nearSite = id;
          nearAnchorSite = "";
          nearLoading = "";
          schedule();
        })
        .catch(() => {
          nearLoading = "";
        });
    }
    const pathGeometry = new THREE.BufferGeometry();
    const pathPositions = new Float32Array(12 * 2 * 3);
    pathGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(pathPositions, 3),
    );
    const lightDiagram = new THREE.LineSegments(
      pathGeometry,
      new THREE.LineBasicMaterial({
        color: "#ffd17a",
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      }),
    );
    lightDiagram.frustumCulled = false;
    scene.add(lightDiagram);
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#f46d61", toneMapped: false }),
    );
    scene.add(pin);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.0015, 8, 40),
      new THREE.MeshBasicMaterial({ color: "#f46d61", toneMapped: false }),
    );
    scene.add(ring);
    const sunlight = new THREE.DirectionalLight("#fff2dc", 3.5);
    sunlight.layers.set(1);
    sunlight.shadow.camera.layers.enable(1);
    sunlight.castShadow = !mobile;
    sunlight.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sunlight.shadow.bias = -0.0000002;
    sunlight.shadow.normalBias = 0.00001;
    scene.add(sunlight);
    scene.add(sunlight.target);
    // Physical solar position gives each planet its own illumination direction.
    // Display exposure is illustrative; inverse-square attenuation is preserved.
    const solarLight = new THREE.PointLight(
      "#fff2e5",
      3.5 * Math.pow(149597870.7 / 1737.4, 2),
      0,
      2,
    );
    scene.add(solarLight);
    const ambient = new THREE.AmbientLight("#8baccf", 0.08);
    ambient.layers.enable(1);
    scene.add(ambient);
    const planetMeshes = new Map();
    let globeDetail = null,
      globeFar = null,
      terrainFull = null,
      terrainLow = null,
      terrainDetail = "full";
    let localFrame = null,
      lookAz = 0,
      lookEl = 0,
      skyTracking = null,
      trackingOffsetEl = 0;
    function releaseSkyTracking() {
      skyTracking = null;
      setFollowing(null);
      latest.current.onFocusChange?.(null);
    }

    readJson("/data/globe/moon-elevation.json")
      .then((meta) => {
        const file = (meta.isotropicFiles ?? meta.files)[mobile ? 1 : 0];
        return readGrid("/data/" + file.file, file.width, file.height);
      })
      .then((grid) => {
        if (disposed) return;
        const install = (g) => {
          if (disposed) {
            g.dispose();
            return;
          }
          moon.geometry.dispose();
          moon.geometry = g;
          // Visual level of detail only: the explanatory globe drops to a
          // coarser mesh when it covers few screen pixels. Numerical
          // visibility never uses this mesh.
          globeDetail = g;
          globeFar?.dispose();
          globeFar = displacedGlobe(grid, 240);
          globeReady = true;
          if (imageryReady) setStatus("");
          schedule();
        };
        const fallback = () =>
          install(displacedGlobe(grid, mobile ? 180 : 360));
        try {
          globeWorker = new Worker(
            new URL("../workers/globe.worker.mjs", import.meta.url),
            { type: "module" },
          );
          globeWorker.onmessage = ({ data }) => {
            globeWorker?.terminate();
            globeWorker = null;
            if (disposed) return;
            if (data.error) {
              fallback();
              return;
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute(
              "position",
              new THREE.BufferAttribute(data.position, 3),
            );
            g.setAttribute("normal", new THREE.BufferAttribute(data.normal, 3));
            g.setAttribute("uv", new THREE.BufferAttribute(data.uv, 2));
            g.setIndex(new THREE.BufferAttribute(data.index, 1));
            g.boundingSphere = new THREE.Sphere(
              new THREE.Vector3().fromArray(data.sphere.center),
              data.sphere.radius,
            );
            install(g);
          };
          globeWorker.onerror = () => {
            globeWorker?.terminate();
            globeWorker = null;
            if (!disposed) fallback();
          };
          const buffer = grid.values.slice().buffer;
          globeWorker.postMessage(
            {
              buffer,
              width: grid.width,
              height: grid.height,
              segments: mobile ? 360 : 720,
            },
            [buffer],
          );
        } catch {
          fallback();
        }
      })
      .catch(() => {
        if (!disposed)
          setStatus(
            "Global relief could not load. The local visibility calculations remain available.",
          );
      });
    function schedule() {
      if (!disposed && !frame) frame = requestAnimationFrame(draw);
    }
    function applyCamera(position, target, up, animate = true) {
      // Opposite reference-frame up axes cannot be linearly blended through zero.
      // Cut on a frame reversal; ordinary same-frame moves retain eased motion.
      if (
        animate &&
        !reduced &&
        previousKey &&
        camera.up.clone().normalize().dot(up.clone().normalize()) > -0.9
      ) {
        transition = {
          start: performance.now(),
          from: camera.position.clone(),
          to: position,
          fromTarget: controls.target.clone(),
          target,
          fromUp: camera.up.clone(),
          up,
        };
      } else {
        transition = null;
        camera.position.copy(position);
        controls.target.copy(target);
        camera.up.copy(up);
      }
      schedule();
    }
    function loadTerrain(id) {
      if (terrainLoading === id || terrainSite === id) return;
      terrainLoading = id;
      readJson("/data/terrain/terrain.json")
        .then((meta) => {
          const tile = meta.tiles.find((t) => t.siteId === id);
          if (!tile) throw Error("No terrain tile");
          return readGrid("/data/" + tile.file, tile.width, tile.height).then(
            (grid) => ({ grid, tile }),
          );
        })
        .then(({ grid, tile }) => {
          if (disposed || latest.current.site?.id !== id) return;
          const g = localTerrain(grid, tile, mobile ? 160 : 300);
          terrainFull?.dispose();
          terrainLow?.dispose();
          terrainFull = g;
          terrainLow =
            terrainDetail === "low" ? localTerrain(grid, tile, 120) : null;
          terrain.geometry = terrainLow ?? g;
          surfaceTerrain.geometry = terrain.geometry;
          const side = Math.round(Math.sqrt(g.attributes.position.count)),
            edge = [];
          const add = (r, c) => {
            const i = (r * side + c) * 3;
            edge.push(...g.attributes.position.array.subarray(i, i + 3));
          };
          for (let c = 0; c < side; c++) add(0, c);
          for (let r = 1; r < side; r++) add(r, side - 1);
          for (let c = side - 2; c >= 0; c--) add(side - 1, c);
          for (let r = side - 2; r > 0; r--) add(r, 0);
          terrainOutline.geometry.dispose();
          terrainOutline.geometry = new THREE.BufferGeometry();
          terrainOutline.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(edge, 3),
          );
          terrainOutline.geometry.computeBoundingSphere();
          surfaceAnchorSite = "";
          terrainGrid = grid;
          terrainTile = tile;
          terrainSite = id;
          terrainLoading = "";
          schedule();
        })
        .catch(() => {
          if (!disposed) {
            terrainLoading = "";
            setError(
              "The local terrain tile could not load. Other cameras and the comparison remain available.",
            );
          }
        });
    }
    function configureWall(profile) {
      const v = [],
        edge = [];
      for (let j = 0; j < profile.length; j++) {
        const a = (j * Math.PI * 2) / profile.length,
          b = ((j + 1) * Math.PI * 2) / profile.length,
          e = (profile[j] * Math.PI) / 180,
          f = (profile[(j + 1) % profile.length] * Math.PI) / 180;
        edge.push(
          10 * Math.sin(a) * Math.cos(e),
          10 * Math.sin(e),
          -10 * Math.cos(a) * Math.cos(e),
        );
        v.push(
          10 * Math.sin(a) * Math.cos(e),
          10 * Math.sin(e),
          -10 * Math.cos(a) * Math.cos(e),
          10 * Math.sin(b) * Math.cos(f),
          10 * Math.sin(f),
          -10 * Math.cos(b) * Math.cos(f),
          0,
          -10,
          0,
        );
      }
      wall.geometry.dispose();
      wall.geometry = new THREE.BufferGeometry();
      wall.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(v, 3),
      );
      wall.geometry.computeBoundingSphere();
      horizonOutline.geometry.dispose();
      horizonOutline.geometry = new THREE.BufferGeometry();
      horizonOutline.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(edge, 3),
      );
      horizonOutline.geometry.computeBoundingSphere();
    }
    function draw(now) {
      frame = 0;
      if (disposed || !imageryReady) return;
      const p = latest.current,
        { sky, index, freeze, view, site, siteData, height } = p;
      // Frame credit: one draw per frameInterval on average, so the 60/120 fps
      // ceiling holds on 144/165 Hz displays without halving them to 72 fps.
      // Credit carries at most one extra frame (e.g. after an idle pause).
      if (Number.isFinite(lastFrameAt))
        frameCredit = Math.min(
          2,
          frameCredit + (now - lastFrameAt) / frameInterval,
        );
      lastFrameAt = now;
      if (frameCredit < 0.98) {
        schedule();
        return;
      }
      frameCredit -= 1;
      adaptResolution(now);
      settingCamera = true;
      if (sky) {
        // GPU presentation follows the display refresh. React text/data updates
        // remain slower and explicitly identify the frame their values describe.
        // At most 100 ms is presented between received clock anchors.
        const i = samplePresentation(
            presentation.current,
            now,
            sky.sunPosKm.length - 1,
          ),
          q = interpolateBodyQuaternion(
            sky.moonOrientationQuat,
            freeze.moonRotation ?? i,
          ),
          eq = interpolateBodyQuaternion(
            sky.earthOrientationQuat,
            freeze.earthRotation ?? i,
          );
        const e = interpolateVector(sky.earthPosKm, freeze.earthPosition ?? i),
          s = interpolateVector(sky.sunPosKm, freeze.sunPosition ?? i),
          earthDirection = e.clone().normalize(),
          sunDirection = s.clone().normalize();
        const exact = view === "sky",
          local = view === "terrain";
        moon.quaternion.copy(q);
        terrain.quaternion.copy(q);
        earth.quaternion.copy(eq);
        earth.position.copy(e).divideScalar(sky.radiiKm.moon);
        earth.scale.setScalar(sky.radiiKm.earth / sky.radiiKm.moon);
        clouds.position.copy(earth.position);
        clouds.quaternion.copy(eq);
        // Illustrative cloud drift (one turn per 20 days relative to Earth),
        // not weather; still with reduced motion.
        // Close Earth views also drift the layer in real time (one turn per
        // 10 minutes) so it visibly moves while paused.
        const earthClose = view === "earth" || trackedBody === "earth";
        if (!reduced)
          clouds.rotateY(
            (2 * Math.PI * i) / (24 * 20) +
              (earthClose ? (2 * Math.PI * now) / 600000 : 0),
          );
        if (!reduced && earthClose) wantsFrame = true;
        clouds.scale.setScalar((sky.radiiKm.earth + 10) / sky.radiiKm.moon);
        atmosphere.position.copy(earth.position);
        atmosphere.quaternion.copy(eq);
        atmosphere.scale.setScalar(
          (sky.radiiKm.earth + 100) / sky.radiiKm.moon,
        );
        atmosphere.material.uniforms.sunDirection.value.copy(
          s.clone().sub(e).normalize(),
        );
        sun.position.copy(s).divideScalar(sky.radiiKm.moon);
        sun.scale.setScalar(sky.radiiKm.sun / sky.radiiKm.moon);
        sun.rotation.y = (2 * Math.PI * i) / ROTATION_H.sun;
        solarLight.position.copy(sun.position);
        solarLight.visible = !local;
        sunlight.visible = local || exact;
        earth.visible = clouds.visible = atmosphere.visible = !local;
        for (const [order, b] of (p.planets?.planets ?? []).entries()) {
          if (!planetMeshes.has(b.id)) {
            const mesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 48, 24),
              new THREE.MeshStandardMaterial({
                color: ROTATION_H[b.id] ? "#ffffff" : b.color,
                map: ROTATION_H[b.id] ? skin(b.id) : null,
                roughness: 0.9,
              }),
            );
            if (b.id === "saturn") {
              // Main rings, 1.24-2.27 Saturn radii, in the equatorial plane.
              const inner = 1.24,
                outer = 2.27,
                ring = new THREE.RingGeometry(inner, outer, 128, 1);
              const pos = ring.attributes.position,
                uv = ring.attributes.uv;
              for (let k = 0; k < pos.count; k++) {
                const r = Math.hypot(pos.getX(k), pos.getY(k));
                uv.setXY(k, (r - inner) / (outer - inner), 0.5);
              }
              const ringMap = appearance.load("/assets/planets/saturn-ring.png");
              ringMap.colorSpace = THREE.SRGBColorSpace;
              const rings = new THREE.Mesh(
                ring,
                new THREE.MeshStandardMaterial({
                  map: ringMap,
                  transparent: true,
                  side: THREE.DoubleSide,
                  roughness: 1,
                  depthWrite: false,
                }),
              );
              rings.rotation.x = -Math.PI / 2;
              mesh.add(rings);
            }
            planetMeshes.set(b.id, mesh);
            scene.add(mesh);
          }
          const m = planetMeshes.get(b.id),
            position = interpolateVector(
              b.posKm,
              freeze["planet-" + b.id] ?? i,
            );
          m.position.copy(position).divideScalar(sky.radiiKm.moon);
          m.scale.setScalar(b.radiusKm / sky.radiiKm.moon);
          if (ROTATION_H[b.id])
            m.rotation.y = (2 * Math.PI * i) / ROTATION_H[b.id];
          m.visible = !local;
        }
        const lat = ((site?.latitudeDeg ?? -89) * Math.PI) / 180,
          lon = ((site?.longitudeEastDeg ?? 0) * Math.PI) / 180;
        const uBody = new THREE.Vector3(
            Math.cos(lat) * Math.cos(lon),
            Math.sin(lat),
            -Math.cos(lat) * Math.sin(lon),
          ),
          eBody = new THREE.Vector3(0, 1, 0).cross(uBody).normalize(),
          nBody = uBody.clone().cross(eBody).normalize();
        const U = uBody.clone().applyQuaternion(q),
          E = eBody.clone().applyQuaternion(q),
          N = nBody.clone().applyQuaternion(q),
          south = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
        const bodyO = uBody
            .clone()
            .multiplyScalar(1 + (site?.terrainElevationM ?? 0) / MOON_RADIUS_M),
          O = bodyO.clone().applyQuaternion(q);
        localFrame = { U, E, N };
        const observationId = [
          i,
          height,
          site?.id,
          freeze.moonRotation,
          freeze.sunPosition,
          freeze.earthPosition,
        ].join("|");
        if (siteData && observationId !== observationKey) {
          const observer = O.clone().addScaledVector(U, height / MOON_RADIUS_M),
            profile = siteData.horizon.elevationDeg[String(height)];
          const disc = (body, radius) => {
            const vector = body.position.clone().sub(observer),
              distance = vector.length(),
              dir = vector.divideScalar(distance),
              azimuth = THREE.MathUtils.radToDeg(
                Math.atan2(dir.dot(E), dir.dot(N)),
              ),
              elevation = THREE.MathUtils.radToDeg(
                Math.asin(THREE.MathUtils.clamp(dir.dot(U), -1, 1)),
              ),
              angularRadius = THREE.MathUtils.radToDeg(
                Math.asin(radius / distance),
              );
            const horizon = horizonAt(profile, azimuth);
            return {
              fraction: visibleDiskFraction(elevation, horizon, angularRadius),
              elevationDeg: elevation,
              azimuthDeg: (azimuth + 360) % 360,
              horizonDeg: horizon,
              angularRadiusDeg: angularRadius,
            };
          };
          const sunDetail = disc(sun, sun.scale.x),
            earthDetail = disc(earth, earth.scale.x);
          const solar = solarObservation(sunDetail, earthDetail);
          sunDetail.terrainFraction = sunDetail.fraction;
          if (solar) {
            sunDetail.fraction = solar.fraction;
            sunDetail.eclipse = solar.eclipse;
            sunDetail.unobscuredFraction = solar.unobscuredFraction;
          }
          currentObservation = {
            siteId: site.id,
            index: i,
            height,
            sun: sunDetail.fraction,
            earth: earthDetail.fraction,
            // Same interpolated geometry as the fractions; used for the text description.
            sunDetail,
            earthDetail,
            frozen: Boolean(
              freeze.moonRotation !== undefined ||
              freeze.sunPosition !== undefined ||
              freeze.earthPosition !== undefined,
            ),
          };
          observationKey = observationId;
        }
        // Publish independently of recomputation: a final frame may have been
        // computed under the throttle immediately before Play stops.
        const context = site?.id + "|" + height;
        if (
          currentObservation &&
          observationKey !== lastPublishedObservationKey &&
          (!p.playing ||
            context !== lastPublishedContext ||
            now - lastObservationAt >= 100)
        ) {
          latest.current.onObservation?.(currentObservation);
          lastObservationAt = now;
          lastPublishedObservationKey = observationKey;
          lastPublishedContext = context;
        }
        pin.position.copy(O).addScaledVector(U, local ? 0.00008 : 0.002);
        pin.scale.setScalar(local ? 0.012 : 1);
        pin.visible = !exact;
        ring.position.copy(O).addScaledVector(U, local ? 0.00002 : 0.0004);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), U);
        ring.scale.setScalar(local ? 0.02 : 1);
        ring.visible = !exact;
        moon.visible = !exact && !local;
        if (globeDetail && globeFar && moon.visible) {
          // Projected radius of the Moon in CSS pixels.
          const d = Math.max(
            camera.position.distanceTo(moon.position) / moon.scale.x,
            1.0001,
          );
          const px =
            (Math.tan(Math.asin(1 / d)) /
              Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) *
            (el.clientHeight / 2);
          // Hysteresis: switch up above 1000 px and down below 800 px, so a
          // radius near the threshold cannot alternate meshes every frame.
          const want =
            moon.geometry === globeDetail
              ? px < 800
                ? globeFar
                : globeDetail
              : px > 1000
                ? globeDetail
                : globeFar;
          if (moon.geometry !== want) moon.geometry = want;
        }
        moonOutline.geometry = moon.geometry;
        moonOutline.quaternion.copy(q);
        moonOutline.visible = p.enhancedVision && moon.visible;
        horizonOutline.visible = p.enhancedVision && exact && !!siteData;
        terrainOutline.visible =
          p.enhancedVision && local && terrainSite === site?.id;
        terrainOutline.quaternion.copy(q);
        terrain.visible = local && terrainSite === site?.id;
        surfaceTerrain.visible =
          exact && p.surfaceStyle !== "diagram" && terrainSite === site?.id;
        surfaceTerrain.quaternion.copy(q);
        const nearWanted =
          surfaceTerrain.visible && terrainDetail === "full" && !!site;
        if (nearWanted) loadNear(site.id);
        nearTerrain.visible = nearWanted && nearSite === site.id;
        nearTerrain.quaternion.copy(q);
        surface.uniforms.patchRadius.value = nearTerrain.visible
          ? NEAR_RADIUS_M
          : 0;
        if (
          nearTerrain.visible &&
          nearAnchorSite !== site.id &&
          surfaceAnchorSite === site.id
        ) {
          const a = alignSurfaceAtObserver(nearTerrain.geometry, bodyO, uBody);
          nearAlignmentM = a === null ? null : a * MOON_RADIUS_M;
          morphNearSeam(nearTerrain.geometry);
          nearAnchorSite = site.id;
        }
        if (nearTerrain.visible) {
          const nearShift = uBody
            .clone()
            .multiplyScalar((nearAlignmentM ?? 0) / MOON_RADIUS_M);
          nearTerrain.position.copy(nearShift).applyQuaternion(q);
          nearSurface.alignment.copy(nearShift);
        }
        wall.material.color.set(
          p.surfaceStyle === "diagram" ? "#697481" : "#080a0d",
        );
        wall.visible = exact && !!siteData;
        if ((local || (exact && p.surfaceStyle !== "diagram")) && site)
          loadTerrain(site.id);
        if (terrainSite === site?.id && surfaceAnchorSite !== site.id) {
          const alignment = alignSurfaceAtObserver(
            terrainFull ?? terrain.geometry,
            bodyO,
            uBody,
          );
          surfaceAlignmentM =
            alignment === null ? null : alignment * MOON_RADIUS_M;
          surfaceAnchorSite = site.id;
        }
        const alignment = uBody
          .clone()
          .multiplyScalar((surfaceAlignmentM ?? 0) / MOON_RADIUS_M);
        surfaceTerrain.position.copy(alignment).applyQuaternion(q);
        surface.alignment.copy(alignment);
        surface.uniforms.surfaceObserver.value
          .copy(bodyO)
          .addScaledVector(uBody, height / MOON_RADIUS_M);
        surface.uniforms.surfaceEast.value.copy(eBody);
        surface.uniforms.surfaceNorth.value.copy(nBody);
        surface.uniforms.surfaceUp.value.copy(uBody);
        const key = view + "|" + (site?.id ?? "");
        if (key !== previousKey) {
          camera.fov = exact ? 45 : 42;
          camera.updateProjectionMatrix();
          controls.enabled = !exact;
          controls.enablePan = false;
          controls.minPolarAngle = 0.015;
          controls.maxPolarAngle = Math.PI - 0.015;
          trackedBody = "moon";
          previousTrackedPosition.set(0, 0, 0);
          if (exact) {
            // Start with the Sun, rather than an unrelated azimuth that can
            // leave both bodies off-screen. Apparent sizes remain physical.
            const direction = sun.position.clone().sub(O).normalize();
            lookAz = Math.atan2(direction.dot(E), direction.dot(N));
            // Slightly lower framing includes the ground. The explicit Sun aim
            // remains exact and does not alter observer position or body scale.
            lookEl =
              Math.asin(THREE.MathUtils.clamp(direction.dot(U), -1, 1)) - 0.1;
            skyTracking = "sun";
            trackingOffsetEl = -0.1;
            setFollowing("sun");
            transition = null;
          } else if (local) {
            localCameraBody = bodyO
              .clone()
              .addScaledVector(eBody, 6000 / MOON_RADIUS_M)
              .addScaledVector(nBody, -4500 / MOON_RADIUS_M)
              .addScaledVector(uBody, 5500 / MOON_RADIUS_M);
            localTargetBody = bodyO.clone();
            applyCamera(
              localCameraBody.clone().applyQuaternion(q),
              localTargetBody.clone().applyQuaternion(q),
              U,
              false,
            );
            controls.minDistance = 0.0015;
            controls.maxDistance = 0.04;
            controls.maxPolarAngle = 1.4;
          } else if (view === "earth") {
            const earthNorth = new THREE.Vector3(0, 1, 0).applyQuaternion(eq);
            trackedBody = "earth";
            previousTrackedPosition.copy(earth.position);
            controls.minDistance = earth.scale.x * 1.02;
            controls.maxDistance = 1e7;
            applyCamera(
              earth.position
                .clone()
                .addScaledVector(sunDirection, earth.scale.x * 2.8)
                .addScaledVector(earthNorth, earth.scale.x * 1.4),
              earth.position.clone(),
              earthNorth,
              false,
            );
          } else if (view === "pair") {
            const middle = earth.position.clone().multiplyScalar(0.5),
              side = earthDirection.clone().cross(south).normalize(),
              distance = earth.position.length();
            trackedBody = "pair";
            previousTrackedPosition.copy(middle);
            controls.minDistance = 2;
            controls.maxDistance = 1e7;
            applyCamera(
              middle.clone().addScaledVector(side, distance * 1.5),
              middle,
              south.clone().negate(),
              false,
            );
          } else if (view === "system") {
            const extent = Math.max(
              ...[...planetMeshes.values()].map((m) => m.position.length()),
              sun.position.length(),
            );
            applyCamera(
              new THREE.Vector3(0, extent * 2, extent),
              sun.position.clone(),
              new THREE.Vector3(0, 1, 0),
              false,
            );
            controls.minDistance = 2;
            controls.maxDistance = 1e7;
          } else if (view === "south") {
            applyCamera(
              south.clone().multiplyScalar(3.2),
              new THREE.Vector3(),
              earthDirection.clone(),
            );
            controls.minDistance = 1.03;
            controls.maxDistance = 1e7;
          } else {
            applyCamera(
              earthDirection
                .clone()
                .multiplyScalar(2.8)
                .addScaledVector(south, 1.6),
              new THREE.Vector3(),
              south.clone().negate(),
            );
            controls.minDistance = 1.03;
            controls.maxDistance = 1e7;
          }
          previousKey = key;
          skyDrag = null;
          if (pendingFocus && !local) {
            const id = pendingFocus;
            pendingFocus = null;
            engine.current?.focus(id);
          }
        }
        if (!exact && !local && trackedBody !== "moon" && !transition) {
          const tracked =
            trackedBody === "earth"
              ? earth
              : trackedBody === "sun"
                ? sun
                : trackedBody === "pair"
                  ? { position: earth.position.clone().multiplyScalar(0.5) }
                  : planetMeshes.get(trackedBody);
          if (tracked) {
            const shift = tracked.position.clone().sub(previousTrackedPosition);
            camera.position.add(shift);
            controls.target.add(shift);
            previousTrackedPosition.copy(tracked.position);
          }
        }
        if (exact) {
          camera.position.copy(
            uBody
              .clone()
              .multiplyScalar(
                1 + ((site?.terrainElevationM ?? 0) + height) / MOON_RADIUS_M,
              )
              .applyQuaternion(q),
          );
          camera.up.copy(U);
          // Follow the currently presented body, including the observer's
          // moving local frame. A one-time azimuth is not continuous tracking.
          const followed =
            skyTracking === "sun"
              ? sun
              : skyTracking === "earth"
                ? earth
                : planetMeshes.get(skyTracking);
          if (followed) {
            const direction = followed.position
              .clone()
              .sub(camera.position)
              .normalize();
            lookAz = Math.atan2(direction.dot(E), direction.dot(N));
            lookEl = THREE.MathUtils.clamp(
              Math.asin(THREE.MathUtils.clamp(direction.dot(U), -1, 1)) +
                trackingOffsetEl,
              -Math.PI / 2 + 0.001,
              Math.PI / 2 - 0.001,
            );
          }
          const dir = N.clone()
            .multiplyScalar(Math.cos(lookEl) * Math.cos(lookAz))
            .addScaledVector(E, Math.cos(lookEl) * Math.sin(lookAz))
            .addScaledVector(U, Math.sin(lookEl));
          camera.lookAt(camera.position.clone().add(dir));
          const hk = site?.id + "|" + height;
          if (siteData && hk !== wallKey) {
            const profile = siteData.horizon.elevationDeg[String(height)];
            configureWall(profile);
            surface.horizon.image.data.set(
              profile.map((value) => THREE.MathUtils.degToRad(value)),
            );
            surface.horizon.needsUpdate = true;
            wallKey = hk;
          }
          wall.position.copy(camera.position);
          wall.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(E, U, N.clone().negate()),
          );
          horizonOutline.position.copy(wall.position);
          horizonOutline.quaternion.copy(wall.quaternion);
        } else if (local && localCameraBody) {
          camera.position.copy(localCameraBody.clone().applyQuaternion(q));
          controls.target.copy(localTargetBody.clone().applyQuaternion(q));
          camera.up.copy(U);
        }
        const localLighting = local || exact;
        const lightTarget = localLighting ? O : new THREE.Vector3(),
          reach = localLighting ? 0.1 : 10,
          bounds = localLighting ? 0.009 : 1.4;
        const shadowSize = p.detailedShadows
          ? mobile
            ? 2048
            : 4096
          : mobile
            ? 1024
            : 2048;
        renderer.shadowMap.enabled = !mobile || p.detailedShadows;
        sunlight.castShadow = renderer.shadowMap.enabled;
        if (sunlight.shadow.mapSize.x !== shadowSize) {
          sunlight.shadow.mapSize.set(shadowSize, shadowSize);
          sunlight.shadow.map?.dispose();
          sunlight.shadow.map = null;
        }
        sunlight.position
          .copy(lightTarget)
          .addScaledVector(sunDirection, reach);
        sunlight.target.position.copy(lightTarget);
        Object.assign(sunlight.shadow.camera, {
          left: -bounds,
          right: bounds,
          top: bounds,
          bottom: -bounds,
          near: localLighting ? 0.04 : 8,
          far: localLighting ? 0.16 : 12,
        });
        sunlight.shadow.camera.updateProjectionMatrix();
        lightDiagram.visible =
          p.lightPaths && localLighting && terrainSite === site?.id;
        if (lightDiagram.visible) {
          const sunBody = sunDirection
            .clone()
            .applyQuaternion(q.clone().invert());
          for (let j = 0; j < 12; j++) {
            const end = bodyO
              .clone()
              .addScaledVector(eBody, (((j % 4) - 1.5) * 1200) / MOON_RADIUS_M)
              .addScaledVector(
                nBody,
                ((Math.floor(j / 4) - 1) * 1200) / MOON_RADIUS_M,
              );
            const start = end
              .clone()
              .addScaledVector(sunBody, 6000 / MOON_RADIUS_M);
            pathPositions.set(start.toArray(), j * 6);
            pathPositions.set(end.toArray(), j * 6 + 3);
          }
          pathGeometry.attributes.position.needsUpdate = true;
          lightDiagram.quaternion.copy(q);
        }
        if (transition && !exact && !local) {
          const t = THREE.MathUtils.clamp((now - transition.start) / 750, 0, 1),
            k = 1 - Math.pow(1 - t, 3);
          camera.position.lerpVectors(transition.from, transition.to, k);
          controls.target.lerpVectors(
            transition.fromTarget,
            transition.target,
            k,
          );
          camera.up
            .lerpVectors(transition.fromUp, transition.up, k)
            .normalize();
          if (t >= 1) transition = null;
          else schedule();
        }
        if (!exact) {
          updateOrbit();
          if (local && terrainGrid && terrainTile && localCameraBody) {
            const body = camera.position
                .clone()
                .applyQuaternion(q.clone().invert()),
              latitude = Math.asin(
                THREE.MathUtils.clamp(body.y / body.length(), -1, 1),
              ),
              longitude = Math.atan2(-body.z, body.x),
              rho = 2 * MOON_RADIUS_M * Math.tan((latitude + Math.PI / 2) / 2),
              x = rho * Math.sin(longitude),
              y = rho * Math.cos(longitude),
              b = terrainTile.boundsPolarStereoM;
            if (x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax) {
              const ground = sampleGrid(
                terrainGrid,
                ((x - b.xMin) / (b.xMax - b.xMin)) * terrainGrid.width - 0.5,
                ((b.yMax - y) / (b.yMax - b.yMin)) * terrainGrid.height - 0.5,
              );
              const floor = 1 + (ground + 150) / MOON_RADIUS_M;
              if (body.length() < floor) {
                body.setLength(floor);
                camera.position.copy(body.clone().applyQuaternion(q));
                updateOrbit();
              }
            }
            localCameraBody = camera.position
              .clone()
              .applyQuaternion(q.clone().invert());
            localTargetBody = controls.target
              .clone()
              .applyQuaternion(q.clone().invert());
          }
          if (!local) {
            // A midpoint or another focus target does not prevent entering Earth.
            // Keep the camera outside every physical body, not just its focus.
            for (const body of [moon, earth, sun, ...planetMeshes.values()]) {
              if (!body.visible) continue;
              const offset = camera.position.clone().sub(body.position),
                clearance = (body === moon ? 1.007 : body.scale.x) * 1.02;
              if (offset.length() < clearance) {
                if (offset.lengthSq() < 1e-18)
                  offset
                    .copy(camera.getWorldDirection(new THREE.Vector3()))
                    .negate();
                camera.position
                  .copy(body.position)
                  .add(offset.setLength(clearance));
                camera.lookAt(controls.target);
              }
            }
          }
        }
        const objects = {
          earth,
          sun,
          site: pin,
          ...Object.fromEntries(planetMeshes),
        };
        camera.updateMatrixWorld();
        for (const [name, obj] of Object.entries(objects)) {
          const node = labels.current[name];
          if (!node) continue;
          const pos = obj.position.clone().project(camera),
            front =
              obj.position
                .clone()
                .sub(camera.position)
                .dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
          const sight = obj.position.clone().sub(camera.position),
            range = sight.length();
          sight.normalize();
          const hiddenByBody = [
            moon,
            earth,
            sun,
            ...planetMeshes.values(),
          ].some((body) => {
            if (!body.visible || body === obj) return false;
            const c = body.position.clone().sub(camera.position),
              along = c.dot(sight),
              radius = body === moon ? 1 : body.scale.x;
            return (
              along > 0 &&
              along <
                range - (name === "site" ? 0.009 * obj.scale.x : obj.scale.x) &&
              c.lengthSq() - along * along < radius * radius
            );
          });
          const show =
            front &&
            !hiddenByBody &&
            pos.z < 1 &&
            Math.abs(pos.x) < 0.94 &&
            Math.abs(pos.y) < 0.88 &&
            (!local || name === "site") &&
            (["earth", "sun", "site"].includes(name) || view === "system") &&
            (!exact ||
              ((name === "earth" || name === "sun") &&
                currentObservation?.[name] > 0));
          node.hidden = !show;
          if (show) {
            node.style.left = (pos.x * 0.5 + 0.5) * el.clientWidth + "px";
            node.style.top = (-pos.y * 0.5 + 0.5) * el.clientHeight + "px";
          }
        }
      }
      // Camera-relative render origin preserves precision even when inspecting Neptune.
      camera.updateMatrixWorld();
      stars.position.copy(camera.position);
      glare.position.copy(sun.position);
      glare.scale.setScalar(
        Math.max(
          sun.scale.x * 5,
          (camera.position.distanceTo(sun.position) *
            2 *
            Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
            110) /
            Math.max(1, el.clientHeight),
        ),
      );
      glare.visible =
        p.opticalGlare && (p.view !== "sky" || currentObservation?.sun > 0);
      scene.position.copy(camera.position).negate();
      renderCamera.copy(camera, false);
      renderCamera.position.set(0, 0, 0);
      renderCamera.updateMatrixWorld();
      // Precompile GPU programs without synchronously stalling the first frame.
      // Camera/time state can keep updating while compilation is in progress.
      if (!shadersReady && !preparingShaders) {
        preparingShaders = true;
        renderer.compileAsync(scene, renderCamera).then(
          () => {
            if (disposed) return;
            shadersReady = true;
            schedule();
          },
          () => {
            if (disposed) return;
            // The regular renderer remains the compatibility fallback.
            shadersReady = true;
            schedule();
          },
        );
      }
      if (shadersReady) {
        if (p.view === "sky") {
          // Three filters lights against the CAMERA, not each receiver's layer.
          // Two depth-preserving passes keep the surface-only directional light
          // from illuminating Earth/planets a second time.
          renderCamera.layers.set(0);
          solarLight.visible = true;
          sunlight.visible = false;
          renderer.render(scene, renderCamera);
          if (surfaceTerrain.visible) {
            renderer.autoClear = false;
            renderCamera.layers.set(1);
            solarLight.visible = false;
            sunlight.visible = true;
            renderer.render(scene, renderCamera);
            renderer.autoClear = true;
          }
          renderCamera.layers.mask = camera.layers.mask;
        } else {
          renderer.render(scene, renderCamera);
        }
        if (horizonOutline.visible) {
          renderer.autoClear = false;
          renderCamera.layers.set(2);
          renderer.render(scene, renderCamera);
          renderer.autoClear = true;
          renderCamera.layers.mask = camera.layers.mask;
        }
        if (qaMode)
          lastRendered = {
            serial: (lastRendered?.serial ?? 0) + 1,
            view: p.view,
            siteId: p.site?.id,
            height: p.height,
            index: p.index,
            presentedIndex: currentObservation?.index,
            frameTimeMs: now,
            renderScale,
            terrainDetail,
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            fpsLimit: mobile ? 60 : 120,
            ready:
              imageryReady &&
              globeReady &&
              (!["terrain", "sky"].includes(p.view) ||
                (p.view === "sky" && p.surfaceStyle === "diagram") ||
                terrainSite === p.site?.id),
          };
      }
      settingCamera = false;
      continuousLoop = !!(p.playing || transition);
      if (p.playing || wantsFrame) schedule();
      wantsFrame = false;
    }
    const change = () => {
      if (
        !settingCamera &&
        latest.current.view === "terrain" &&
        latest.current.sky
      ) {
        // Input belongs to the pose actually presented, not the slower React
        // clock anchor. Otherwise each gesture introduces body-frame drift.
        const q = moon.quaternion.clone().invert();
        localCameraBody = camera.position.clone().applyQuaternion(q);
        localTargetBody = controls.target.clone().applyQuaternion(q);
      }
      if (!settingCamera) schedule();
    };
    controls.addEventListener("change", change);
    const cancelTransition = () => {
      transition = null;
    };
    controls.addEventListener("start", cancelTransition);
    const resize = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight, false);
      camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.updateProjectionMatrix();
      schedule();
    });
    resize.observe(el);
    const down = (e) => {
        upgradeImagery();
        if (latest.current.view === "sky" && !skyDrag && e.button === 0) {
          // One pointer owns a sky drag until it ends. A second finger must not
          // replace its origin or move the view when the first finger resumes.
          skyDrag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
          releaseSkyTracking();
          renderer.domElement.setPointerCapture(e.pointerId);
        }
      },
      move = (e) => {
        if (skyDrag && e.pointerId === skyDrag.pointerId) {
          lookAz -= (e.clientX - skyDrag.x) * 0.002;
          lookEl = THREE.MathUtils.clamp(
            lookEl + (e.clientY - skyDrag.y) * 0.002,
            -1.4,
            1.4,
          );
          skyDrag.x = e.clientX;
          skyDrag.y = e.clientY;
          schedule();
        }
      },
      up = (e) => {
        if (!skyDrag || e.pointerId !== skyDrag.pointerId) return;
        skyDrag = null;
        if (e && renderer.domElement.hasPointerCapture(e.pointerId))
          renderer.domElement.releasePointerCapture(e.pointerId);
      },
      wheel = (e) => {
        upgradeImagery();
        if (latest.current.view === "sky") {
          e.preventDefault();
          camera.fov = THREE.MathUtils.clamp(
            camera.fov * (e.deltaY > 0 ? 1.1 : 0.9),
            2,
            90,
          );
          camera.updateProjectionMatrix();
          schedule();
        }
      };
    for (const [event, handler] of [
      ["pointerdown", down],
      ["pointermove", move],
      ["pointerup", up],
      ["pointercancel", up],
      ["lostpointercapture", up],
      ["wheel", wheel],
    ])
      renderer.domElement.addEventListener(
        event,
        handler,
        event === "wheel" ? { passive: false } : undefined,
      );
    engine.current = {
      schedule,
      reset() {
        latest.current.onFocusChange?.(null);
        previousKey = "";
        transition = null;
        schedule();
      },
      move(dx, dy) {
        upgradeImagery();
        transition = null;
        if (latest.current.view === "sky") {
          releaseSkyTracking();
          lookAz += dx;
          lookEl = THREE.MathUtils.clamp(lookEl + dy, -1.4, 1.4);
        } else {
          const basis = new THREE.Quaternion().setFromUnitVectors(
              camera.up.clone().normalize(),
              new THREE.Vector3(0, 1, 0),
            ),
            offset = camera.position
              .clone()
              .sub(controls.target)
              .applyQuaternion(basis),
            s = new THREE.Spherical().setFromVector3(offset);
          s.theta += dx;
          s.phi = THREE.MathUtils.clamp(
            s.phi - dy,
            controls.minPolarAngle,
            controls.maxPolarAngle,
          );
          camera.position
            .copy(controls.target)
            .add(
              new THREE.Vector3()
                .setFromSpherical(s)
                .applyQuaternion(basis.invert()),
            );
          change();
        }
        schedule();
      },
      zoom(f) {
        upgradeImagery();
        transition = null;
        if (latest.current.view === "sky") {
          camera.fov = THREE.MathUtils.clamp(camera.fov * f, 2, 90);
          camera.updateProjectionMatrix();
        } else {
          const offset = camera.position.clone().sub(controls.target);
          offset.setLength(
            THREE.MathUtils.clamp(
              offset.length() * f,
              controls.minDistance,
              controls.maxDistance,
            ),
          );
          camera.position.copy(controls.target).add(offset);
          change();
        }
        schedule();
      },
      // Close orbit view of a body (Earth uses its own preset). From the
      // surface views this switches to the orbit view first.
      inspect(id) {
        transition = null;
        if (["sky", "terrain"].includes(latest.current.view)) {
          pendingFocus = id;
          latest.current.onViewChange?.(id === "earth" ? "earth" : "overview");
          return;
        }
        this.focus(id);
      },
      focus(id) {
        transition = null;
        if (latest.current.view === "terrain") {
          pendingFocus = id;
          latest.current.onViewChange?.(id === "earth" ? "earth" : "overview");
          return;
        }
        const obj =
          id === "moon"
            ? moon
            : id === "earth"
              ? earth
              : id === "sun"
                ? sun
                : planetMeshes.get(id);
        if (!obj) return;
        latest.current.onFocusChange?.(id);
        if (latest.current.view === "sky" && localFrame) {
          const d = obj.position.clone().sub(camera.position).normalize();
          lookAz = Math.atan2(d.dot(localFrame.E), d.dot(localFrame.N));
          lookEl = Math.asin(THREE.MathUtils.clamp(d.dot(localFrame.U), -1, 1));
          skyTracking = id;
          trackingOffsetEl = 0;
          setFollowing(id);
        } else {
          const r = id === "moon" ? 1 : obj.scale.x;
          trackedBody = id;
          previousTrackedPosition.copy(obj.position);
          controls.minDistance = r * 1.03;
          controls.maxDistance = 1e7;
          camera.fov = 42;
          camera.updateProjectionMatrix();
          applyCamera(
            obj.position
              .clone()
              .addScaledVector(
                id === "sun"
                  ? new THREE.Vector3(0, 0, 1)
                  : sun.position.clone().sub(obj.position).normalize(),
                r * 3.2,
              )
              .add(new THREE.Vector3(0, r * 0.8, 0)),
            obj.position.clone(),
            new THREE.Vector3(0, 1, 0),
            false,
          );
        }
        schedule();
      },
      releaseTracking() {
        releaseSkyTracking();
        schedule();
      },
    };
    const keyboard = (event) => {
      const actions = {
        ArrowLeft: () => engine.current?.move(-0.12, 0),
        ArrowRight: () => engine.current?.move(0.12, 0),
        ArrowUp: () => engine.current?.move(0, 0.12),
        ArrowDown: () => engine.current?.move(0, -0.12),
        "+": () => engine.current?.zoom(0.85),
        "=": () => engine.current?.zoom(0.85),
        "-": () => engine.current?.zoom(1.15),
        Home: () => engine.current?.reset(),
      };
      if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
      }
    };
    renderer.domElement.addEventListener("keydown", keyboard);
    if (qaMode) {
      renderer.domElement.lunarSnapshot = () => ({
        view: latest.current.view,
        index: latest.current.index,
        trackedBody,
        skyTracking,
        camera: {
          position: camera.position.toArray(),
          direction: camera.getWorldDirection(new THREE.Vector3()).toArray(),
          quaternion: camera.quaternion.toArray(),
          target: controls.target.toArray(),
          up: camera.up.toArray(),
          fov: camera.fov,
          aspect: camera.aspect,
          minDistance: controls.minDistance,
          maxDistance: controls.maxDistance,
        },
        bodies: Object.fromEntries(
          [["moon", moon], ["earth", earth], ["sun", sun], ...planetMeshes].map(
            ([id, m]) => [
              id,
              {
                position: m.position.toArray(),
                radius: m.scale.x,
                visible: m.visible,
              },
            ],
          ),
        ),
        origin: scene.position.toArray(),
        transition: !!transition,
        observation: currentObservation,
        surface: {
          style: latest.current.surfaceStyle,
          alignmentM: surfaceAlignmentM,
          nearAlignmentM,
          nearVisible: nearTerrain.visible,
          terrainReady: terrainSite === latest.current.site?.id,
          horizonClipped: true,
          lightPaths: latest.current.lightPaths,
          glare: latest.current.opticalGlare,
          detailedShadows: latest.current.detailedShadows,
          enhancedVision: latest.current.enhancedVision,
        },
        rendered: lastRendered,
      });
    }
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(uploadFrame);
      globeWorker?.terminate();
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("keydown", keyboard);
      for (const [event, handler] of [
        ["pointerdown", down],
        ["pointermove", move],
        ["pointerup", up],
        ["pointercancel", up],
        ["lostpointercapture", up],
        ["wheel", wheel],
      ])
        renderer.domElement.removeEventListener(event, handler);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material && o.material !== lunarMaterial) o.material.dispose();
      });
      lunarMaterial.dispose();
      moonMap.dispose();
      earthMap.dispose();
      oceanMap.dispose();
      cloudMap.dispose();
      starsMap.dispose();
      glareTexture.dispose();
      surface.horizon.dispose();
      globeDetail?.dispose();
      globeFar?.dispose();
      terrainFull?.dispose();
      terrainLow?.dispose();
      nearTerrain.geometry.dispose();
      nearSurface.material.dispose();
      renderer.dispose();
      el.replaceChildren();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.schedule();
  }, [
    sky,
    planets,
    index,
    freeze,
    view,
    site,
    siteData,
    height,
    surfaceStyle,
    lightPaths,
    opticalGlare,
    enhancedVision,
    detailedShadows,
    playing,
    speed,
  ]);
  return (
    <>
      <div className="space-canvas" ref={host} />
      <div className="world-labels" aria-hidden="true">
        {[
          ["earth", "Earth"],
          ["sun", "Sun"],
          ["site", site?.name.split(" (")[0] ?? "Selected point"],
          ...(planets?.planets ?? []).map((p) => [p.id, p.name]),
        ].map(([id, name]) => (
          <span
            hidden
            key={id}
            ref={(el) => {
              labels.current[id] = el;
            }}
            className={"world-label " + id}
          >
            {name}
          </span>
        ))}
      </div>
      {status ? (
        <p className="asset-status" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="scene-error" role="status">
          {error}
        </p>
      ) : null}
      <div className="camera-controls" aria-label="Camera controls">
        {view === "sky" ? (
          <>
            <button
              aria-pressed={following === "sun"}
              title="Follow the current Sun direction as time moves"
              onClick={() => engine.current?.focus("sun")}
            >
              Look at Sun
            </button>
            <button
              aria-pressed={following === "earth"}
              title="Follow the current Earth direction as time moves"
              onClick={() => engine.current?.focus("earth")}
            >
              Look at Earth
            </button>
            <button onClick={() => onViewChange?.("terrain")}>
              See sunlit terrain
            </button>
            <button
              className="follow-toggle"
              aria-pressed={following === "sun"}
              onClick={() =>
                following === "sun"
                  ? engine.current?.releaseTracking()
                  : engine.current?.focus("sun")
              }
            >
              Keep following Sun{" "}
              <span aria-hidden="true">
                {following === "sun" ? "On" : "Off"}
              </span>
            </button>
            {following && following !== "sun" ? (
              <button
                className="tracking-state"
                onClick={() => engine.current?.releaseTracking()}
              >
                Following{" "}
                {following === "sun"
                  ? "Sun"
                  : following === "earth"
                    ? "Earth"
                    : (planets?.planets.find((p) => p.id === following)?.name ??
                      following)}{" "}
                · Stop following
              </button>
            ) : !following ? (
              <span className="tracking-state">
                Free look · choose Sun or Earth to follow
              </span>
            ) : null}
          </>
        ) : null}
        <span className="inspect-label" aria-hidden="true">
          Inspect individual planets
        </span>
        <select
          aria-label="Inspect individual planets: close view of a body"
          defaultValue=""
          onChange={(e) => {
            engine.current?.inspect(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Look at a body…
          </option>
          {view !== "sky" ? <option value="moon">Moon</option> : null}
          <option value="earth">Earth</option>
          <option value="sun">Sun</option>
          {planets?.planets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={() => engine.current?.reset()}>Reset view</button>
        {PLANET_NOTES[following] ? (
          <p className="planet-note">{PLANET_NOTES[following]}</p>
        ) : null}
        <details className="manual-camera-controls">
          <summary>Navigation</summary>
          <div>
            <button
              aria-label="Rotate camera left"
              onClick={() => engine.current?.move(-0.2, 0)}
            >
              Left
            </button>
            <button
              aria-label="Rotate camera right"
              onClick={() => engine.current?.move(0.2, 0)}
            >
              Right
            </button>
            <button
              aria-label="Rotate camera up"
              onClick={() => engine.current?.move(0, 0.13)}
            >
              Up
            </button>
            <button
              aria-label="Rotate camera down"
              onClick={() => engine.current?.move(0, -0.13)}
            >
              Down
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => engine.current?.zoom(0.85)}
            >
              +
            </button>
            <button
              aria-label="Zoom out"
              onClick={() => engine.current?.zoom(1.15)}
            >
              −
            </button>
          </div>
        </details>
      </div>
    </>
  );
}
