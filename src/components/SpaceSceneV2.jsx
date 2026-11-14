// Data-driven explanatory rendering. Scientific outputs remain in sites/*.json.
// AI assistance and third-party provenance: /ai-use.json, Credits and data manifests.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  readJson,
  readGrid,
  displacedGlobe,
  localTerrain,
  MOON_RADIUS_M,
  interpolateVector,
  interpolateBodyQuaternion,
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
      previousKey = "",
      terrainSite = "",
      terrainLoading = "",
      wallKey = "",
      transition = null,
      skyDrag = null,
      localCameraBody = null,
      localTargetBody = null,
      settingCamera = false;
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
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(62, 1, 1e-7, 5e6);
    camera.position.set(0, 1, 3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.minDistance = 1.03;
    controls.maxDistance = 140;
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
    const earthMap = loader.load("/data/globe/earth-visual-2k.jpg", schedule);
    earthMap.colorSpace = THREE.SRGBColorSpace;
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
      new THREE.SphereGeometry(4e6, 48, 24),
      new THREE.MeshBasicMaterial({
        map: starsMap,
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        color: "#424b5b",
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
      new THREE.SphereGeometry(1, 64, 40),
      new THREE.MeshStandardMaterial({ map: earthMap, roughness: 0.85 }),
    );
    scene.add(earth);
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: "#fff0bd", toneMapped: false }),
    );
    scene.add(sun);
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
        const g = displacedGlobe(grid, mobile ? 360 : 720);
        moon.geometry.dispose();
        moon.geometry = g;
        setStatus("");
        schedule();
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
      if (animate && !reduced && previousKey) {
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
        earth.position.copy(
          exact
            ? e.clone().divideScalar(sky.radiiKm.moon)
            : earthDirection.clone().multiplyScalar(40),
        );
        earth.scale.setScalar(sky.radiiKm.earth / sky.radiiKm.moon);
        sun.position.copy(
          exact
            ? s.clone().divideScalar(sky.radiiKm.moon)
            : sunDirection.clone().multiplyScalar(60),
        );
        sun.scale.setScalar(exact ? sky.radiiKm.sun / sky.radiiKm.moon : 0.22);
        for (const [order, b] of (p.planets?.planets ?? []).entries()) {
          if (!planetMeshes.has(b.id)) {
            const mesh = new THREE.Mesh(
              new THREE.SphereGeometry(1, 24, 16),
              new THREE.MeshBasicMaterial({ color: b.color }),
            );
            planetMeshes.set(b.id, mesh);
            scene.add(mesh);
          }
          const m = planetMeshes.get(b.id),
            position = interpolateVector(
              b.posKm,
              freeze["planet-" + b.id] ?? i,
            );
          m.position.copy(
            exact
              ? position.divideScalar(sky.radiiKm.moon)
              : position.normalize().multiplyScalar(34 + order * 3),
          );
          m.scale.setScalar(
            exact
              ? b.radiusKm / sky.radiiKm.moon
              : THREE.MathUtils.clamp(
                  (b.radiusKm / sky.radiiKm.moon) * 0.025,
                  0.04,
                  0.3,
                ),
          );
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
          camera.fov = exact ? 24 : view === "overview" ? 82 : 62;
          camera.updateProjectionMatrix();
          controls.enabled = !exact;
          controls.enablePan = true;
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
            controls.minDistance = 0.00005;
            controls.maxDistance = 0.04;
          } else if (view === "system") {
            applyCamera(
              new THREE.Vector3(0, 25, 105),
              new THREE.Vector3(),
              new THREE.Vector3(0, 1, 0),
            );
            controls.minDistance = 1.03;
            controls.maxDistance = 150;
          } else if (view === "south") {
            applyCamera(
              south.clone().multiplyScalar(2.55),
              new THREE.Vector3(),
              earthDirection.clone(),
            );
            controls.minDistance = 1.03;
            controls.maxDistance = 100;
          } else {
            applyCamera(
              south
                .clone()
                .multiplyScalar(1.4)
                .addScaledVector(earthDirection, -0.6),
              south
                .clone()
                .multiplyScalar(0.6)
                .addScaledVector(earthDirection, 0.4),
              south.clone(),
            );
            controls.minDistance = 0.3;
            controls.maxDistance = 100;
          }
          previousKey = key;
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
          controls.update();
          if (!local && camera.position.length() < 1.015) {
            camera.position.normalize().multiplyScalar(1.015);
            controls.update();
          }
        }
        const objects = {
          earth,
          sun,
          site: pin,
          ...Object.fromEntries(planetMeshes),
        };
        for (const [name, obj] of Object.entries(objects)) {
          const node = labels.current[name];
          if (!node) continue;
          const pos = obj.position.clone().project(camera),
            front =
              obj.position
                .clone()
                .sub(camera.position)
                .dot(camera.getWorldDirection(new THREE.Vector3())) > 0;
          const show =
            front &&
            pos.z < 1 &&
            Math.abs(pos.x) < 0.94 &&
            Math.abs(pos.y) < 0.88 &&
            (!local || name === "site") &&
            (["earth", "sun", "site"].includes(name) || view === "system") &&
            (!exact || name === "earth" || name === "sun");
          node.hidden = !show;
          if (show) {
            node.style.left = (pos.x * 0.5 + 0.5) * el.clientWidth + "px";
            node.style.top = (-pos.y * 0.5 + 0.5) * el.clientHeight + "px";
          }
        }
      }
      renderer.render(scene, camera);
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
      schedule();
    };
    controls.addEventListener("change", change);
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
      up = () => {
        skyDrag = null;
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
        previousKey = "";
        transition = null;
        schedule();
      },
      move(dx, dy) {
        if (latest.current.view === "sky") {
          lookAz += dx;
          lookEl = THREE.MathUtils.clamp(lookEl + dy, -1.4, 1.4);
        } else {
          const offset = camera.position.clone().sub(controls.target),
            s = new THREE.Spherical().setFromVector3(offset);
          s.theta += dx;
          s.phi = THREE.MathUtils.clamp(s.phi + dy, 0.01, Math.PI - 0.01);
          camera.position
            .copy(controls.target)
            .add(new THREE.Vector3().setFromSpherical(s));
          change();
        }
        schedule();
      },
      zoom(f) {
        if (latest.current.view === "sky") {
          camera.fov = THREE.MathUtils.clamp(camera.fov * f, 2, 90);
          camera.updateProjectionMatrix();
        } else {
          camera.position
            .sub(controls.target)
            .multiplyScalar(f)
            .add(controls.target);
          change();
        }
        schedule();
      },
      focus(id) {
        const obj =
          id === "moon"
            ? moon
            : id === "earth"
              ? earth
              : id === "sun"
                ? sun
                : planetMeshes.get(id);
        if (!obj) return;
        if (latest.current.view === "sky" && localFrame) {
          const d = obj.position.clone().sub(camera.position).normalize();
          lookAz = Math.atan2(d.dot(localFrame.E), d.dot(localFrame.N));
          lookEl = Math.asin(THREE.MathUtils.clamp(d.dot(localFrame.U), -1, 1));
        } else {
          const r = id === "moon" ? 1 : obj.scale.x;
          applyCamera(
            obj.position
              .clone()
              .add(new THREE.Vector3(0, r, Math.max(r * 4, 0.5))),
            obj.position.clone(),
            new THREE.Vector3(0, 1, 0),
          );
        }
        schedule();
      },
    };
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
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
      starsMap.dispose();
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
        <button aria-label="Zoom in" onClick={() => engine.current?.zoom(0.85)}>
          +
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => engine.current?.zoom(1.15)}
        >
          −
        </button>
      </div>
    </>
  );
}
