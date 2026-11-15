// Geometry of the Learn "Raise the observer" cartoon. The verdict and the
// drawing come from this one function, so the picture can never contradict
// the text. Units are schematic; the drawing stretches heights 2x.
export const RAISE_FRAME = {
  width: 400,
  ground: 130, // y of the flat ground, px
  unitX: 4, // px per schematic unit, horizontal
  unitY: 8, // px per schematic unit, vertical (2x exaggeration)
  observerX: 40,
  flankPx: 50, // horizontal half-width of the ridge base, px
  sunX: 372, // where the ray ends when nothing clips it
  sunTopY: 14, // highest y at which the Sun may be drawn
};

export function raiseGeometry(h, ridge, sunElevationDeg, f = RAISE_FRAME) {
  const tan = Math.tan((sunElevationDeg * Math.PI) / 180);
  // Ray height in units at the ridge crest. The ray rises more slowly than
  // the ridge flank, so the crest is the first possible contact.
  const clearance = h + ridge.distance * tan - ridge.height;
  const visible = clearance > 0;
  const slope = tan * (f.unitY / f.unitX); // px rise per px run
  const eye = { x: f.observerX, y: f.ground - h * f.unitY };
  const crest = {
    x: f.observerX + ridge.distance * f.unitX,
    y: f.ground - ridge.height * f.unitY,
  };
  const rayY = (x) => eye.y - (x - eye.x) * slope;
  // Sun on the ray, pulled back along it if it would leave the picture.
  const sunX = Math.min(f.sunX, eye.x + (eye.y - f.sunTopY) / slope);
  const sun = { x: sunX, y: rayY(sunX) };
  // Blocked: where the ray meets the near flank, from (crest.x - flank,
  // ground) up to the crest.
  let hit = null;
  if (!visible) {
    const x0 = crest.x - f.flankPx,
      flank = (f.ground - crest.y) / f.flankPx; // px rise per px run
    // eye.y - (x - eye.x) * slope = ground - (x - x0) * flank
    const x =
      eye.y >= f.ground
        ? x0
        : (eye.y - f.ground + eye.x * slope - x0 * flank) / (slope - flank);
    const hx = Math.min(crest.x, Math.max(x0, x));
    hit = { x: hx, y: rayY(hx) };
  }
  return {
    visible,
    clearance,
    threshold: ridge.height - ridge.distance * tan,
    eye,
    crest,
    sun,
    hit,
  };
}
