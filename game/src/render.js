// Meridian Ridge Run — canvas renderer: sky, projected terrain, rings.
// The camera sits at the aircraft and looks along its heading and pitch.
import { VIEW, WORLD } from './config.js';
import { fieldId, isRiver, isRunway, terrainHeight } from './world.js';

const SKY_TOP = '#5f97d6';
const SKY_HORIZON = '#f6d9a4';
const FIELD_COLORS = ['#6f9a4e', '#7fae56', '#a8a05a', '#5d8a46', '#b59a5e', '#86a860', '#94a854'];
const FOREST = '#3f6b34';
const ROCK = '#8a7f72';
const SNOW = '#eef3f6';
const WATER = '#3d7ea6';

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const SKY_RGB = hexRgb(SKY_HORIZON);

// Project a world point into screen space. Returns null behind the camera.
export function project(cam, x, y, z) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const dz = z - cam.z;
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const forward = dx * sh + dz * ch;
  const right = dx * ch - dz * sh;
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  const up = dy * cp - forward * sp;
  const fwd = dy * sp + forward * cp;
  if (fwd < 12) return null;
  const f = VIEW.focal;
  let sx = VIEW.width / 2 + (right / fwd) * f;
  let sy = VIEW.height / 2 - (up / fwd) * f;
  // Roll the picture plane around the screen centre.
  const sr = Math.sin(cam.roll);
  const cr = Math.cos(cam.roll);
  const ox = sx - VIEW.width / 2;
  const oy = sy - VIEW.height / 2;
  sx = VIEW.width / 2 + ox * cr - oy * sr;
  sy = VIEW.height / 2 + ox * sr + oy * cr;
  return { x: sx, y: sy, depth: fwd };
}

export function horizonY(cam) {
  return VIEW.height / 2 + VIEW.focal * Math.tan(cam.pitch);
}

function drawSky(ctx, cam, time) {
  const hy = horizonY(cam);
  const grad = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 1));
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, Math.max(hy, 1));
  // Sun, fixed in the west so it stays put as you turn.
  const sunAngle = -0.9 - cam.heading;
  const sunX = VIEW.width / 2 + Math.tan(sunAngle) * VIEW.focal * 0.9;
  const sunY = hy - 150;
  if (sunX > -80 && sunX < VIEW.width + 80) {
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 220, 140, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 120, sunY - 120, 240, 240);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  // Drifting cloud puffs, placed in the world so they parallax with turns.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 9; i += 1) {
    const cx = (i * 613 - 2400) % 4800 - 2400;
    const cz = cam.z + 900 + i * 260;
    const cy = 420 + (i % 3) * 90;
    const p = project(cam, cx, cy, cz);
    if (!p) continue;
    const s = clamp(90000 / p.depth, 14, 90);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 2.2, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  void time;
}

// Colour one terrain cell, with distance fog mixed toward the horizon sky.
function cellColor(x, z, seed, depth) {
  const h = terrainHeight(x, z, seed);
  let base;
  if (isRunway(x, z)) base = [76, 78, 86];
  else if (isRiver(x, z, seed)) base = hexRgb(WATER);
  else if (h > WORLD.snowLine) base = hexRgb(SNOW);
  else if (h > WORLD.rockLine) base = hexRgb(ROCK);
  else if (h > 60 && ((x + z) % 340) < 40) base = hexRgb(FOREST);
  else base = hexRgb(FIELD_COLORS[fieldId(x, z, seed)]);
  const fog = clamp(depth / 2400, 0, 0.75);
  return mixColor(base, SKY_RGB, fog);
}

// The ground right under the camera is too close for the terrain grid to
// cover (its cells start 120 m ahead), so fill everything below the horizon
// with the local ground colour first; the grid then paints the far field
// over it. Without this the low shots show the page background as a void.
function drawGroundFill(ctx, cam, seed) {
  const colour = cellColor(cam.x, cam.z, seed, 0);
  const left = project(cam, cam.x - 4000, cam.y, cam.z + 4000);
  const right = project(cam, cam.x + 4000, cam.y, cam.z + 4000);
  const hy = horizonY(cam);
  const yL = left ? left.y : hy;
  const yR = right ? right.y : hy;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, yL);
  ctx.lineTo(VIEW.width, yR);
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.lineTo(0, VIEW.height);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, cam, seed) {
  const cell = WORLD.cellSize;
  const zStart = Math.floor((cam.z + 120) / cell) * cell;
  const zEnd = cam.z + WORLD.groundSize;
  const x0 = Math.floor((cam.x - WORLD.halfWidth) / cell) * cell;
  const x1 = cam.x + WORLD.halfWidth;
  for (let z = zEnd; z >= zStart; z -= cell) {
    for (let x = x0; x < x1; x += cell) {
      const h00 = terrainHeight(x, z, seed);
      const h10 = terrainHeight(x + cell, z, seed);
      const h01 = terrainHeight(x, z + cell, seed);
      const h11 = terrainHeight(x + cell, z + cell, seed);
      const p00 = project(cam, x, h00, z);
      const p10 = project(cam, x + cell, h10, z);
      const p01 = project(cam, x, h01, z + cell);
      const p11 = project(cam, x + cell, h11, z + cell);
      if (!p00 || !p10 || !p01 || !p11) continue;
      const depth = (p00.depth + p11.depth) / 2;
      ctx.fillStyle = cellColor(x + cell / 2, z + cell / 2, seed, depth);
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
      // Runway centreline dashes and edge lines, so the strip reads from the air.
      if (isRunway(x + cell / 2, z + cell / 2)) {
        const m0 = project(cam, x + cell / 2, 2.4, z + 12);
        const m1 = project(cam, x + cell / 2, 2.4, z + cell - 12);
        if (m0 && m1) {
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = Math.max(1, 500 / m0.depth);
          ctx.beginPath();
          ctx.moveTo(m0.x, m0.y);
          ctx.lineTo(m1.x, m1.y);
          ctx.stroke();
          for (const side of [-1, 1]) {
            const e0 = project(cam, x + cell / 2 + side * 12, 2.4, z + 6);
            const e1 = project(cam, x + cell / 2 + side * 12, 2.4, z + cell - 6);
            if (e0 && e1) {
              ctx.strokeStyle = 'rgba(255,255,255,0.6)';
              ctx.lineWidth = Math.max(1, 350 / e0.depth);
              ctx.beginPath();
              ctx.moveTo(e0.x, e0.y);
              ctx.lineTo(e1.x, e1.y);
              ctx.stroke();
            }
          }
        }
      }
    }
  }
}

function drawRings(ctx, cam, rings, time) {
  const sorted = [...rings].filter((r) => !r.passed).sort((a, b) => b.z - a.z);
  for (const ring of sorted) {
    const p = project(cam, ring.x, ring.y, ring.z);
    if (!p || p.depth > 2600) continue;
    const pr = project(cam, ring.x + ring.r, ring.y, ring.z);
    if (!pr) continue;
    const radius = Math.abs(pr.x - p.x);
    if (radius < 2) continue;
    const pulse = 0.75 + 0.25 * Math.sin(time * 4 + ring.z);
    ctx.save();
    ctx.globalAlpha = clamp(1.4 - p.depth / 2200, 0.25, 1) * pulse;
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.shadowColor = '#ffb02e';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// The aircraft, drawn in screen space as a chase view, banking with the roll.
function drawAircraft(ctx, cam, time) {
  const cx = VIEW.width / 2;
  const cy = VIEW.height * 0.66;
  const bob = Math.sin(time * 2.2) * 2;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.rotate(cam.roll * 0.9);
  const S = 1; // scale
  // Wing glow from the engines.
  const glow = ctx.createRadialGradient(0, 26 * S, 2, 0, 26 * S, 46);
  glow.addColorStop(0, 'rgba(120, 180, 255, 0.55)');
  glow.addColorStop(1, 'rgba(120, 180, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-46, -20, 92, 92);
  // Swept wings.
  ctx.fillStyle = '#c9ced4';
  ctx.strokeStyle = '#5d646c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(-168, 34);
  ctx.lineTo(-168, 46);
  ctx.lineTo(-16, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.lineTo(168, 34);
  ctx.lineTo(168, 46);
  ctx.lineTo(16, 22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Tail fins.
  ctx.fillStyle = '#b7bec6';
  ctx.beginPath();
  ctx.moveTo(-12, -34);
  ctx.lineTo(-34, -72);
  ctx.lineTo(-20, -72);
  ctx.lineTo(-4, -36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -34);
  ctx.lineTo(34, -72);
  ctx.lineTo(20, -72);
  ctx.lineTo(4, -36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fuselage, tapering toward the tail.
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#9aa1a9');
  body.addColorStop(0.5, '#e8ebee');
  body.addColorStop(1, '#9aa1a9');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-16, 30);
  ctx.lineTo(-13, -38);
  ctx.quadraticCurveTo(0, -52, 13, -38);
  ctx.lineTo(16, 30);
  ctx.quadraticCurveTo(0, 40, -16, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Red cheatline and roundel.
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-15, 6, 30, 5);
  ctx.beginPath();
  ctx.arc(0, -6, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#2c6cb2';
  ctx.fill();
  // Canopy.
  ctx.fillStyle = '#274b73';
  ctx.beginPath();
  ctx.ellipse(0, -26, 7, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-2, -30, 2.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Navigation lights.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-168, 40, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#34d17b';
  ctx.beginPath();
  ctx.arc(168, 40, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hudBox(ctx, x, y, label, value, unit) {
  ctx.fillStyle = 'rgba(8, 18, 28, 0.62)';
  ctx.fillRect(x, y, 132, 52);
  ctx.strokeStyle = 'rgba(140, 220, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 132, 52);
  ctx.fillStyle = '#8cdcff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 10, y + 17);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(String(value), x + 10, y + 42);
  ctx.fillStyle = '#8cdcff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(unit, x + 122, y + 42);
  ctx.textAlign = 'left';
}

function drawHud(ctx, world, screen) {
  const s = world.state;
  const knots = Math.round(s.speed * 1.944);
  const headingDeg = Math.round(((s.heading * 180) / Math.PI % 360 + 360) % 360);
  hudBox(ctx, 16, 16, 'ALTITUDE', Math.round(s.y), 'm');
  hudBox(ctx, 156, 16, 'AIRSPEED', knots, 'kt');
  hudBox(ctx, 296, 16, 'HEADING', String(headingDeg).padStart(3, '0'), 'deg');
  // Compass tape.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.62)';
  ctx.fillRect(VIEW.width / 2 - 150, 16, 300, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (let i = -2; i <= 2; i += 1) {
    const deg = Math.round((headingDeg + i * 15) / 15) * 15;
    const label = deg % 90 === 0 ? dirs[((deg / 45) % 8 + 8) % 8] : String(((deg % 360) + 360) % 360);
    ctx.fillText(label, VIEW.width / 2 + i * 56, 34);
  }
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(VIEW.width / 2, 42);
  ctx.lineTo(VIEW.width / 2 - 5, 48);
  ctx.lineTo(VIEW.width / 2 + 5, 48);
  ctx.closePath();
  ctx.fill();
  // Fuel, clock, score, rings — top right.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.62)';
  ctx.fillRect(VIEW.width - 268, 16, 252, 96);
  ctx.strokeStyle = 'rgba(140, 220, 255, 0.55)';
  ctx.strokeRect(VIEW.width - 267.5, 16.5, 252, 96);
  ctx.fillStyle = '#8cdcff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', VIEW.width - 256, 34);
  ctx.fillStyle = s.fuel < 20 ? '#ff5a4e' : '#37d67a';
  ctx.fillRect(VIEW.width - 256, 40, 228 * (s.fuel / 100), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(VIEW.width - 256, 40, 228, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  const mm = Math.floor(Math.max(0, s.timeLeft) / 60);
  const ss = Math.floor(Math.max(0, s.timeLeft) % 60);
  ctx.fillText(`TIME ${mm}:${String(ss).padStart(2, '0')}`, VIEW.width - 256, 74);
  ctx.fillText(`SCORE ${s.score}`, VIEW.width - 256, 96);
  ctx.textAlign = 'right';
  ctx.fillText(`RINGS ${s.rings}/${world.rings.length}`, VIEW.width - 28, 96);
  ctx.textAlign = 'left';
  // Artificial horizon, bottom left.
  const ax = 78;
  const ay = VIEW.height - 78;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, 52, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-s.roll);
  ctx.translate(0, s.pitch * 90);
  ctx.fillStyle = '#5f97d6';
  ctx.fillRect(-60, -60, 120, 60);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-60, 0, 120, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-60, -1, 120, 2);
  ctx.restore();
  ctx.strokeStyle = '#8cdcff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(ax - 14, ay);
  ctx.lineTo(ax, ay - 6);
  ctx.lineTo(ax + 14, ay);
  ctx.lineTo(ax, ay + 4);
  ctx.closePath();
  ctx.fill();
  // Throttle bar, bottom right.
  ctx.fillStyle = 'rgba(8, 18, 28, 0.62)';
  ctx.fillRect(VIEW.width - 66, VIEW.height - 150, 50, 134);
  ctx.fillStyle = '#37d67a';
  const th = 120 * s.throttle;
  ctx.fillRect(VIEW.width - 58, VIEW.height - 28 - th, 34, th);
  ctx.fillStyle = '#8cdcff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', VIEW.width - 41, VIEW.height - 160);
  ctx.textAlign = 'left';
  // Centre message.
  if (s.messageTime > 0 && s.message) {
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.message, VIEW.width / 2, 150);
    ctx.textAlign = 'left';
  }
  if (screen === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Arrows fly  ·  Shift/Ctrl throttle  ·  P pause  ·  R restart', 16, VIEW.height - 14);
  }
}

// Title, pause and results screens, drawn over the live scene.
function drawTitle(ctx, world, selectedMission) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.45)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MERIDIAN RIDGE RUN', VIEW.width / 2, 150);
  ctx.fillStyle = '#ffb02e';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('A dawn flight over the valley — thread the rings, mind the fuel.', VIEW.width / 2, 186);
  const missions = world.missions;
  missions.forEach((m, i) => {
    const y = 250 + i * 78;
    const sel = i === selectedMission;
    ctx.fillStyle = sel ? 'rgba(255, 176, 46, 0.92)' : 'rgba(8, 18, 28, 0.72)';
    ctx.fillRect(VIEW.width / 2 - 300, y, 600, 62);
    ctx.strokeStyle = sel ? '#ffffff' : 'rgba(140, 220, 255, 0.5)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeRect(VIEW.width / 2 - 300 + 0.5, y + 0.5, 600, 62);
    ctx.fillStyle = sel ? '#1a1206' : '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${m.name}`, VIEW.width / 2 - 284, y + 27);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = sel ? '#4a3410' : '#cfe8ff';
    ctx.fillText(m.blurb, VIEW.width / 2 - 284, y + 48);
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Arrows / WASD — fly   ·   Shift / Ctrl — throttle   ·   Click a mission or press 1–3, then Enter to fly', VIEW.width / 2, 520);
  ctx.fillStyle = '#ffb02e';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('CLICK A MISSION OR PRESS ENTER', VIEW.width / 2, 556);
  ctx.textAlign = 'left';
}

function drawOver(ctx, world) {
  const s = world.state;
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.reason, VIEW.width / 2, 240);
  ctx.fillStyle = '#ffb02e';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`SCORE ${s.score}`, VIEW.width / 2, 300);
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText(`Rings ${s.rings} of ${world.rings.length}  ·  Best ${s.best}`, VIEW.width / 2, 340);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('R — fly again    ·    M — missions', VIEW.width / 2, 396);
  ctx.textAlign = 'left';
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(6, 14, 24, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', VIEW.width / 2, 330);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P — resume    ·    R — restart    ·    M — missions', VIEW.width / 2, 372);
  ctx.textAlign = 'left';
}

// One frame: sky, terrain, rings, aircraft, HUD, then the screen overlay.
export function drawFrame(ctx, game, time) {
  const { world, screen, selectedMission } = game;
  const s = world.state;
  const cam = { x: s.x, y: s.y + 6, z: s.z - 26, heading: s.heading, pitch: s.pitch * 0.6, roll: s.roll };
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawSky(ctx, cam, time);
  drawGroundFill(ctx, cam, world.mission.seed);
  drawTerrain(ctx, cam, world.mission.seed);
  drawRings(ctx, cam, world.rings, time);
  drawAircraft(ctx, cam, time);
  if (screen === 'play' || screen === 'paused' || screen === 'over') drawHud(ctx, world, screen);
  if (screen === 'title') drawTitle(ctx, { missions: game.missions }, selectedMission);
  else if (screen === 'over') drawOver(ctx, world);
  else if (screen === 'paused') drawPaused(ctx);
}
