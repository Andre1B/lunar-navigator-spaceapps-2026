import test from 'node:test';
import assert from 'node:assert/strict';
import { raiseGeometry, RAISE_FRAME } from '../src/lib/learnGeometry.mjs';

const ridge = { distance: 60, height: 6 };
const elevationDeg = 4;
const tan = Math.tan(elevationDeg * Math.PI / 180);
const threshold = ridge.height - ridge.distance * tan;
const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('Raise the observer uses the exact ray/crest threshold and keeps verdict and drawing consistent', () => {
  close(threshold, 1.804391283389375);
  const cases = [
    [1.8, false],
    [1.8043, false],
    [threshold, false],
    [1.81, true],
    [1.9, true],
    [2.0, true],
    [3.9, true],
    [4, true],
    [10, true],
  ];
  const slope = tan * RAISE_FRAME.unitY / RAISE_FRAME.unitX;

  for (const [height, visible] of cases) {
    const result = raiseGeometry(height, ridge, elevationDeg);
    assert.equal(result.visible, visible, `visibility at h=${height}`);
    close(result.threshold, threshold);

    // Independently project the eye-to-Sun ray to the crest using the SVG scale.
    const rayAtCrest = result.eye.y - (result.crest.x - result.eye.x) * slope;
    assert.equal(rayAtCrest < result.crest.y, visible, `ray/crest relation at h=${height}`);

    close(result.sun.y, result.eye.y - (result.sun.x - result.eye.x) * slope);
    assert.ok(result.sun.y >= RAISE_FRAME.sunTopY - 1e-12, `Sun clipped above the SVG at h=${height}`);
    if (height === 10) {
      close(result.sun.x, 297.4119926208147);
      close(result.sun.y, 14);
    }

    if (visible) {
      assert.equal(result.hit, null, `visible ray should not end on terrain at h=${height}`);
    } else {
      assert.ok(result.hit, `blocked ray needs a terrain contact at h=${height}`);
      const nearFlankStart = result.crest.x - RAISE_FRAME.flankPx;
      assert.ok(result.hit.x >= nearFlankStart - 1e-9 && result.hit.x <= result.crest.x + 1e-9,
        `contact is outside the near flank at h=${height}: ${JSON.stringify(result.hit)}`);
      const flankY = RAISE_FRAME.ground +
        ((result.hit.x - nearFlankStart) / RAISE_FRAME.flankPx) * (result.crest.y - RAISE_FRAME.ground);
      close(result.hit.y, flankY);
      close(result.hit.y, result.eye.y - (result.hit.x - result.eye.x) * slope);
    }
  }
});
