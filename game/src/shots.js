// Meridian Ridge Run — deterministic screenshot scenes behind
// ?shot=start|play|end. Each scene plays the real rules forward from a fresh
// world for a fixed number of steps, steered by a simple autopilot that aims
// for the next ring, so the frame is what a short game really looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_OVER, resetWorld, stepWorld, terrainHeight } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const END_LIMIT_SECONDS = 400;
const SAMPLE = 1 / 30;

/**
 * Steer toward the next unpassed ring: bank toward its bearing, pitch toward
 * its height, keep the throttle up, and pull up when the ground gets close.
 */
export function autopilot(world) {
  const s = world.state;
  const ring = world.rings.find((r) => !r.passed);
  if (!ring) return { roll: 0, pitch: 0, throttle: 0 };
  const dx = ring.x - s.x;
  const dz = ring.z - s.z;
  const dist = Math.hypot(dx, dz) || 1;
  const bearing = Math.atan2(dx, dz);
  let rel = bearing - s.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const groundClear = s.y - terrainHeight(s.x, s.z, world.mission.seed);
  const wantPitch = (ring.y - s.y) / Math.max(80, dist);
  const roll = Math.max(-1, Math.min(1, rel * 1.6));
  let pitch = Math.max(-1, Math.min(1, wantPitch * 2.5));
  if (groundClear < 60) pitch = Math.max(pitch, 0.7);
  // Throttle is a delta: hold it up until the target cruise, then ease off.
  const throttle = s.throttle < 0.7 ? 1 : s.throttle > 0.85 ? -1 : 0;
  return { roll, pitch, throttle };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over the strip, the aircraft taxiing out.
 * play: mid-flight, threading rings over the valley.
 * end: the sortie flown to its end, results on screen.
 */
export function stageShot(name, world) {
  resetWorld(world, world.mission.id);
  const s = world.state;
  if (name !== 'play' && name !== 'end') {
    s.throttle = 0.55;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      stepWorld(world, { roll: 0, pitch: 0, throttle: 0.4 }, STEP);
    }
    s.speed = 0;
    s.y = 2;
    s.z = 40;
    return 'title';
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = stepWorld(world, autopilot(world), STEP);
    if (events & EVENT_OVER) break;
  }
  return world.state.over ? 'over' : 'play';
}

export { SAMPLE };
