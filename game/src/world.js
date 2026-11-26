// Meridian Ridge Run — the valley, the ring course and the flight model.
// Coordinates: x lateral, y altitude, z forward (heading 0 flies toward +z).
// The runway sits at the origin; the valley runs away from it to the north.
import { MISSIONS, PLANE, SCORE, STEP, WORLD } from './config.js';
import { fbm2, mulberry32 } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_OVER = 2;
export const EVENT_LANDED = 4;

const RUNWAY_HALF = 14; // m, half the runway width
const RUNWAY_LENGTH = 900; // m of flat strip from the origin
const TWO_PI = Math.PI * 2;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= TWO_PI;
  while (angle < -Math.PI) angle += TWO_PI;
  return angle;
}

// Terrain height in metres. Flat near the runway, rolling fields, a river
// valley winding through the middle, mountains rising at the edges.
export function terrainHeight(x, z, seed) {
  const ax = Math.abs(x);
  const flat = smoothstep(60, 260, ax) * smoothstep(-50, 500, z);
  const hills = fbm2(x * 0.0016, z * 0.0016, seed) * 55;
  const ridge = Math.pow(Math.max(0, fbm2(x * 0.0009 + 40, z * 0.0009, seed + 9)), 2) * 260;
  const edge = smoothstep(700, 1150, ax) * 180;
  const riverX = 260 * Math.sin(z * 0.0011 + 1.2) - 120;
  const river = Math.max(0, 1 - Math.abs(x - riverX) / 90);
  let h = 6 + (hills + ridge + edge) * flat - river * river * 14;
  if (Math.abs(x) < RUNWAY_HALF && z > -80 && z < RUNWAY_LENGTH) h = 2;
  return Math.max(0, h);
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Patchwork fields: which field a ground cell belongs to, for colouring.
export function fieldId(x, z, seed) {
  const cx = Math.floor(x / 260);
  const cz = Math.floor(z / 260);
  let h = (Math.imul(cx, 2654435761) ^ Math.imul(cz, 40503) ^ Math.imul(seed, 97)) >>> 0;
  return h % 7;
}

export function isRiver(x, z, seed) {
  const riverX = 260 * Math.sin(z * 0.0011 + 1.2) - 120;
  return Math.abs(x - riverX) < 34 && terrainHeight(x, z, seed) < WORLD.waterLevel + 3;
}

export function isRunway(x, z) {
  return Math.abs(x) < RUNWAY_HALF && z > -80 && z < RUNWAY_LENGTH;
}

// Lay out a ring course: a gentle slalom that climbs, dips and turns.
function buildRings(mission) {
  const rand = mulberry32(mission.seed * 7 + 3);
  const rings = [];
  let x = 0;
  let z = 500;
  let y = 95;
  for (let i = 0; i < mission.ringCount; i += 1) {
    x = clamp(x + (rand() - 0.5) * 520, -640, 640);
    z += 420 + rand() * 260;
    y = clamp(y + (rand() - 0.5) * 70, 55, 210);
    // Keep every ring well above the ground it hangs over.
    const ground = terrainHeight(x, z, mission.seed);
    y = Math.max(y, ground + 45);
    rings.push({ x, y, z, r: mission.ringRadius, passed: false });
  }
  return rings;
}

export function createWorld(missionId) {
  const mission = MISSIONS[missionId] ?? MISSIONS[0];
  return {
    mission,
    state: freshState(mission),
    rings: buildRings(mission),
    events: EVENT_NONE,
  };
}

function freshState(mission) {
  return {
    x: 0, y: 2, z: 0,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    fuel: mission.startFuel,
    damage: 0,
    score: 0, rings: 0,
    timeLeft: mission.timeLimit,
    over: false, landed: false, reason: '',
    message: '', messageTime: 0,
    best: 0,
    airborne: false,
  };
}

export function resetWorld(world, missionId) {
  const mission = MISSIONS[missionId] ?? MISSIONS[0];
  world.mission = mission;
  world.state = freshState(mission);
  world.rings = buildRings(mission);
  world.events = EVENT_NONE;
}

// One fixed step of the flight model. Input is { roll, pitch, throttle } each
// in [-1, 1] (throttle is a delta), plus whether the brakes are held.
export function stepWorld(world, input, dt) {
  const s = world.state;
  if (s.over) return EVENT_NONE;
  const seed = world.mission.seed;
  let events = EVENT_NONE;

  // --- Controls: bank, pitch and throttle ease toward the pilot's input.
  const targetRoll = clamp(input.roll * PLANE.maxRoll, -PLANE.maxRoll, PLANE.maxRoll);
  s.roll += clamp(targetRoll - s.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
  const targetPitch = clamp(input.pitch * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
  s.pitch += clamp(targetPitch - s.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
  s.throttle = clamp(s.throttle + input.throttle * dt * 0.9, 0, 1);
  if (s.fuel <= 0) s.throttle = 0;

  // --- Speed: throttle sets a target; climbing bleeds speed, diving gains it.
  const targetSpeed = PLANE.minSpeed + s.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  const climbFactor = 1 - Math.sin(s.pitch) * 0.35;
  s.speed += clamp(targetSpeed * climbFactor - s.speed, -26 * dt, 20 * dt);
  if (s.speed < 8) s.speed = 8;

  // --- Heading follows the bank; position follows heading, pitch and speed.
  s.heading = wrapAngle(s.heading + Math.sin(s.roll) * PLANE.turnRate * s.speed / 60 * dt);
  const forward = s.speed * dt;
  s.x += Math.sin(s.heading) * forward;
  s.z += Math.cos(s.heading) * forward;
  s.y += Math.sin(s.pitch) * PLANE.climbRate * dt * (0.4 + s.speed / PLANE.maxSpeed);
  if (s.y < 1.5) s.y = 1.5;
  if (s.y > 20) s.airborne = true;

  // --- Fuel, clock and messages.
  s.fuel = Math.max(0, s.fuel - s.throttle * PLANE.fuelBurn * dt);
  s.timeLeft -= dt;
  if (s.messageTime > 0) s.messageTime -= dt;

  // --- Rings: did the flight segment cross the ring's plane inside its circle?
  const prevZ = s.z - Math.cos(s.heading) * forward;
  const prevX = s.x - Math.sin(s.heading) * forward;
  const prevY = s.y - Math.sin(s.pitch) * PLANE.climbRate * dt * (0.4 + s.speed / PLANE.maxSpeed);
  for (let i = 0; i < world.rings.length; i += 1) {
    const ring = world.rings[i];
    if (ring.passed) continue;
    const dz = s.z - prevZ;
    if (dz <= 0) continue;
    const t = (ring.z - prevZ) / dz;
    if (t < 0 || t > 1) continue;
    const cx = prevX + (s.x - prevX) * t;
    const cy = prevY + (s.y - prevY) * t;
    const dx = cx - ring.x;
    const dy = cy - ring.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ring.r) {
      ring.passed = true;
      s.rings += 1;
      const perfect = dist < ring.r * 0.4;
      s.score += SCORE.ring + (perfect ? SCORE.perfectRing : 0);
      s.message = perfect ? 'PERFECT RING! +150' : 'RING! +100';
      s.messageTime = 1.6;
      events |= EVENT_RING;
    }
  }

  // --- Ground: only after the aircraft has been airborne. A gentle
  // touchdown on the strip is a landing, anything else a crash. Soft fields
  // forgive a slow scrape; rock does not.
  const ground = terrainHeight(s.x, s.z, seed);
  const clearance = s.y - ground;
  const onStrip = isRunway(s.x, s.z);
  if (s.airborne && clearance <= PLANE.groundClearance) {
    const verticalSpeed = Math.abs(Math.sin(s.pitch)) * s.speed;
    if (onStrip && s.speed < 55 && verticalSpeed < 12 && s.y <= 4) {
      s.landed = true;
      s.over = true;
      s.score += SCORE.landing + Math.round(Math.max(0, s.timeLeft) * SCORE.timeBonusPerSecond);
      s.reason = 'LANDED SAFELY';
      events |= EVENT_LANDED | EVENT_OVER;
    } else if (clearance <= 1.5) {
      s.damage = 100;
      s.over = true;
      s.reason = onStrip ? 'OVERRAN THE RUNWAY' : 'TERRAIN STRIKE';
      events |= EVENT_OVER;
    }
  }

  // --- Out of time, out of fuel over rough ground, or mission complete.
  if (s.timeLeft <= 0 && !s.over) {
    s.over = true;
    s.reason = 'OUT OF TIME';
    events |= EVENT_OVER;
  }
  if (s.fuel <= 0 && !s.over && s.airborne && clearance < 12) {
    s.over = true;
    s.reason = 'OUT OF FUEL';
    events |= EVENT_OVER;
  }
  if (s.rings >= world.rings.length && !s.over) {
    s.over = true;
    s.reason = 'COURSE COMPLETE';
    s.score += Math.round(Math.max(0, s.timeLeft) * SCORE.timeBonusPerSecond);
    events |= EVENT_OVER;
  }
  if (s.over) s.best = Math.max(s.best, s.score);
  return events;
}

export { clamp, wrapAngle, STEP };
