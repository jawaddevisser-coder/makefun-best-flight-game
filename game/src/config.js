// Meridian Ridge Run — tuning constants and mission definitions.
// All units are metres, seconds and radians unless noted.
export const VIEW = { width: 1280, height: 720, focal: 640 };
export const STEP = 1 / 60;

export const PLANE = {
  minSpeed: 35, // m/s, stall speed
  maxSpeed: 130, // m/s at full throttle
  climbRate: 22, // m/s of vertical speed at full pitch
  rollRate: 1.9, // rad/s of bank change
  pitchRate: 0.9, // rad/s of pitch change
  turnRate: 0.55, // rad/s of heading change at full bank
  maxRoll: 1.1, // rad, about 63 degrees of bank
  maxPitch: 0.55, // rad, about 31 degrees
  groundClearance: 3, // m above terrain before a crash counts
  fuelBurn: 0.55, // fuel points per second at full throttle
  fuelStart: 100,
};

export const WORLD = {
  groundSize: 2600, // m of terrain drawn ahead of the camera
  cellSize: 100, // m per terrain cell
  halfWidth: 1200, // m of terrain drawn to each side
  waterLevel: 4,
  snowLine: 190,
  rockLine: 120,
};

// Three sorties. Each has its own terrain seed, ring course and clock.
export const MISSIONS = [
  {
    id: 0,
    name: 'Ring Run',
    blurb: 'Thread 10 rings over the valley. 180 seconds on the clock.',
    seed: 101,
    timeLimit: 180,
    ringCount: 10,
    ringRadius: 26,
    startFuel: 100,
  },
  {
    id: 1,
    name: 'Canyon Slalom',
    blurb: 'Twelve tight gates, low over the river canyon. 150 seconds.',
    seed: 207,
    timeLimit: 150,
    ringCount: 12,
    ringRadius: 22,
    startFuel: 100,
  },
  {
    id: 2,
    name: 'Dawn Patrol',
    blurb: 'Eight rings, then put her down on the strip before the tanks run dry.',
    seed: 313,
    timeLimit: 240,
    ringCount: 8,
    ringRadius: 28,
    startFuel: 70,
  },
];

export const SCORE = { ring: 100, perfectRing: 50, landing: 250, timeBonusPerSecond: 2 };
