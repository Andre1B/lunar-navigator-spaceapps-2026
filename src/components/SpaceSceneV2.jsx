// Data-driven explanatory rendering. Scientific outputs remain in sites/*.json.
// AI assistance and third-party provenance: /ai-use.json, Credits and data manifests.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { horizonAt, visibleDiskFraction } from "../lib/analysis.mjs";
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
}) {
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
    [error, setError] = useState(null);
  const labels = useRef({});
  useEffect(() => {
    const el = host.current,
      mobile = matchMedia("(max-width:720px)").matches,
      reduced = matchMedia("(prefers-reduced-motion:reduce)").matches;
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
    let pendingFocus = null;
    let observationKey = "",
      currentObservation = null;
    let terrainGrid = null,
      terrainTile = null;
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
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
    const loader = new THREE.TextureLoader();
    THREE.Cache.enabled = true;
    const moonMap = loader.load(
      "/data/globe/moon-color-lroc-" +
        (mobile ? "2048x1024" : "4096x2048") +
        ".jpg",
      schedule,
    );
    moonMap.colorSpace = THREE.SRGBColorSpace;
    moonMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const earthMap = loader.load(
      "/data/globe/earth-visual-" + (mobile ? "2k" : "4k") + ".jpg",
      schedule,
    );
    earthMap.colorSpace = THREE.SRGBColorSpace;
    earthMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const oceanMap = loader.load(
      "/data/globe/earth-ocean-specular-2k.jpg",
      schedule,
    );
    const cloudMap = loader.load(
      "/data/globe/earth-clouds-illustrative-2k.jpg",
      schedule,
    );
    const starsMap = loader.load(
      "/data/starmap/starmap-2020-celestial-" +
        (mobile ? "2048x1024" : "4096x2048") +
        ".jpg",
      schedule,
    );
    starsMap.colorSpace = THREE.SRGBColorSpace;
    starsMap.wrapS = THREE.RepeatWrapping;
    starsMap.repeat.x = -1;
    starsMap.offset.x = 1;
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
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: "#fff0bd", toneMapped: false }),
    );
    scene.add(sun);
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
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    scene.add(terrain);
    const wall = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: "#192433", side: THREE.DoubleSide }),
    );
    scene.add(wall);
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
    scene.add(new THREE.AmbientLight("#8baccf", 0.08));
    const planetMeshes = new Map();
    let localFrame = null,
      lookAz = 0,
      lookEl = 0;

    readJson("/data/globe/moon-elevation.json")
      .then((meta) => {
        const file = (meta.isotropicFiles ?? meta.files)[mobile ? 1 : 0];
        return readGrid("/data/" + file.file, file.width, file.height);
      })
      .then((grid) => {
        if (disposed) return;
        const install = (g) => {
          if (disposed) { g.dispose(); return; }
          moon.geometry.dispose(); moon.geometry = g; setStatus(""); schedule();
        };
        const fallback = () => install(displacedGlobe(grid, mobile ? 180 : 360));
        try {
          globeWorker = new Worker(new URL("../workers/globe.worker.mjs", import.meta.url), {type:"module"});
          globeWorker.onmessage = ({data}) => {
            globeWorker?.terminate(); globeWorker = null;
            if (disposed) return;
            if (data.error) { fallback(); return; }
            const g = new THREE.BufferGeometry();
            g.setAttribute("position",new THREE.BufferAttribute(data.position,3));
            g.setAttribute("normal",new THREE.BufferAttribute(data.normal,3));
            g.setAttribute("uv",new THREE.BufferAttribute(data.uv,2));
            g.setIndex(new THREE.BufferAttribute(data.index,1));
            g.boundingSphere = new THREE.Sphere(new THREE.Vector3().fromArray(data.sphere.center),data.sphere.radius);
            install(g);
          };
          globeWorker.onerror = () => { globeWorker?.terminate(); globeWorker = null; if (!disposed) fallback(); };
          const buffer = grid.values.slice().buffer;
          globeWorker.postMessage({buffer,width:grid.width,height:grid.height,segments:mobile?360:720},[buffer]);
        } catch { fallback(); }
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
          terrain.geometry.dispose();
          terrain.geometry = g;
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
      const v = [];
      for (let j = 0; j < profile.length; j++) {
        const a = (j * Math.PI * 2) / profile.length,
          b = ((j + 1) * Math.PI * 2) / profile.length,
          e = (profile[j] * Math.PI) / 180,
          f = (profile[(j + 1) % profile.length] * Math.PI) / 180;
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
    }
    function draw(now) {
      frame = 0;
      if (disposed) return;
      const p = latest.current,
        { sky, index, freeze, view, site, siteData, height } = p;
      settingCamera = true;
      if (sky) {
        const i = THREE.MathUtils.clamp(index, 0, sky.sunPosKm.length - 1),
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
        solarLight.position.copy(sun.position);
        solarLight.visible = !local;
        sunlight.visible = local;
        earth.visible = clouds.visible = atmosphere.visible = !local;
        for (const [order, b] of (p.planets?.planets ?? []).entries()) {
          if (!planetMeshes.has(b.id)) {
            const mesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 24, 16),
              new THREE.MeshStandardMaterial({
                color: b.color,
                roughness: 0.9,
              }),
            );
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
            return visibleDiskFraction(
              elevation,
              horizonAt(profile, azimuth),
              angularRadius,
            );
          };
          currentObservation = {
            siteId: site.id,
            index: i,
            height,
            sun: disc(sun, sun.scale.x),
            earth: disc(earth, earth.scale.x),
          };
          observationKey = observationId;
          latest.current.onObservation?.(currentObservation);
        }
        pin.position.copy(O).addScaledVector(U, local ? 0.00008 : 0.002);
        pin.scale.setScalar(local ? 0.012 : 1);
        pin.visible = !exact;
        ring.position.copy(O).addScaledVector(U, local ? 0.00002 : 0.0004);
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), U);
        ring.scale.setScalar(local ? 0.02 : 1);
        ring.visible = !exact;
        moon.visible = !exact && !local;
        terrain.visible = local && terrainSite === site?.id;
        wall.visible = exact && !!siteData;
        if (local && site) loadTerrain(site.id);
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
            lookAz = Math.atan2(
              earth.position.clone().sub(O).dot(E),
              earth.position.clone().sub(O).dot(N),
            );
            lookEl = 0;
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
          const dir = N.clone()
            .multiplyScalar(Math.cos(lookEl) * Math.cos(lookAz))
            .addScaledVector(E, Math.cos(lookEl) * Math.sin(lookAz))
            .addScaledVector(U, Math.sin(lookEl));
          camera.lookAt(camera.position.clone().add(dir));
          const hk = site?.id + "|" + height;
          if (siteData && hk !== wallKey) {
            configureWall(siteData.horizon.elevationDeg[String(height)]);
            wallKey = hk;
          }
          wall.position.copy(camera.position);
          wall.quaternion.setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(E, U, N.clone().negate()),
          );
        } else if (local && localCameraBody) {
          camera.position.copy(localCameraBody.clone().applyQuaternion(q));
          controls.target.copy(localTargetBody.clone().applyQuaternion(q));
          camera.up.copy(U);
        }
        const lightTarget = local ? O : new THREE.Vector3(),
          reach = local ? 0.1 : 10,
          bounds = local ? 0.009 : 1.4;
        sunlight.position
          .copy(lightTarget)
          .addScaledVector(sunDirection, reach);
        sunlight.target.position.copy(lightTarget);
        Object.assign(sunlight.shadow.camera, {
          left: -bounds,
          right: bounds,
          top: bounds,
          bottom: -bounds,
          near: local ? 0.04 : 8,
          far: local ? 0.16 : 12,
        });
        sunlight.shadow.camera.updateProjectionMatrix();
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
      glare.visible = true;
      scene.position.copy(camera.position).negate();
      renderCamera.copy(camera, false);
      renderCamera.position.set(0, 0, 0);
      renderCamera.updateMatrixWorld();
      renderer.render(scene, renderCamera);
      settingCamera = false;
    }
    const change = () => {
      if (
        !settingCamera &&
        latest.current.view === "terrain" &&
        latest.current.sky
      ) {
        const q = interpolateBodyQuaternion(
          latest.current.sky.moonOrientationQuat,
          latest.current.freeze.moonRotation ?? latest.current.index,
        ).invert();
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
        if (latest.current.view === "sky") {
          skyDrag = { x: e.clientX, y: e.clientY };
          renderer.domElement.setPointerCapture(e.pointerId);
        }
      },
      move = (e) => {
        if (skyDrag) {
          lookAz -= (e.clientX - skyDrag.x) * 0.002;
          lookEl = THREE.MathUtils.clamp(
            lookEl + (e.clientY - skyDrag.y) * 0.002,
            -1.4,
            1.4,
          );
          skyDrag = { x: e.clientX, y: e.clientY };
          schedule();
        }
      },
      up = (e) => {
        skyDrag = null;
        if (e && renderer.domElement.hasPointerCapture(e.pointerId))
          renderer.domElement.releasePointerCapture(e.pointerId);
      },
      wheel = (e) => {
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
        transition = null;
        if (latest.current.view === "sky") {
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
    if (new URLSearchParams(location.search).has("qa")) {
      renderer.domElement.lunarSnapshot = () => ({
        view: latest.current.view,
        index: latest.current.index,
        trackedBody,
        camera: {
          position: camera.position.toArray(),
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
      });
    }
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      globeWorker?.terminate();
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("keydown", keyboard);
      for (const [event, handler] of [
        ["pointerdown", down],
        ["pointermove", move],
        ["pointerup", up],
        ["pointercancel", up],
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
      renderer.dispose();
      el.replaceChildren();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.schedule();
  }, [sky, planets, index, freeze, view, site, siteData, height]);
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
        <select
          aria-label="Focus a celestial body"
          defaultValue=""
          onChange={(e) => {
            engine.current?.focus(e.target.value);
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
