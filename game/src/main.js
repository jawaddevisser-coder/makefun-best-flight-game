// Meridian Ridge Run — boot, game loop and screen flow.
// Screens: title (mission select), play, paused, over (results).
// ?shot=start|play|end&seed=N stages a deterministic screenshot scene.
import { MISSIONS, STEP, VIEW } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { drawFrame } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, EVENT_LANDED, EVENT_OVER, EVENT_RING, resetWorld, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') ?? 1);

const game = {
  world: createWorld(0),
  missions: MISSIONS,
  selectedMission: 0,
  screen: 'title',
  time: 0,
};
const input = createInput(canvas);
const audio = createAudio();
fitCanvas();
window.addEventListener('resize', fitCanvas);

function announce(text) {
  if (statusLine) statusLine.textContent = text;
}

function startMission(id) {
  resetWorld(game.world, id);
  game.selectedMission = id;
  game.screen = 'play';
  game.world.state.message = `${game.missions[id].name} — fly the rings!`;
  game.world.state.messageTime = 2.5;
  announce(`Mission ${game.missions[id].name} started.`);
  audio.unlock();
}

function handleAction(code) {
  if (code === 'KeyM') {
    game.screen = 'title';
    input.clearPressed();
    return;
  }
  if (game.screen === 'title') {
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
      game.selectedMission = Number(code.slice(-1)) - 1;
    } else if (code === 'Enter' || code === 'Space') {
      startMission(game.selectedMission);
    }
    return;
  }
  if (game.screen === 'play') {
    if (code === 'KeyP') game.screen = 'paused';
    else if (code === 'KeyR') startMission(game.selectedMission);
    return;
  }
  if (game.screen === 'paused') {
    if (code === 'KeyP' || code === 'Enter') game.screen = 'play';
    else if (code === 'KeyR') startMission(game.selectedMission);
    return;
  }
  if (game.screen === 'over') {
    if (code === 'KeyR' || code === 'Enter') startMission(game.selectedMission);
  }
}

function handleClick(click) {
  if (!click) return;
  audio.unlock();
  if (game.screen !== 'title') return;
  for (let i = 0; i < game.missions.length; i += 1) {
    const y = 250 + i * 78;
    if (click.x > VIEW.width / 2 - 300 && click.x < VIEW.width / 2 + 300 && click.y > y && click.y < y + 62) {
      game.selectedMission = i;
      startMission(i);
      return;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - frame.last) / 1000 || STEP);
  frame.last = now;
  game.time += dt;

  let action = input.consumeAction();
  while (action) {
    handleAction(action);
    action = input.consumeAction();
  }
  handleClick(input.consumeClick());

  if (game.screen === 'play') {
    const events = stepWorld(game.world, input.flight(), dt);
    const s = game.world.state;
    audio.engine(s.throttle, s.speed);
    if (events & EVENT_RING) audio.ring(false);
    if (events & EVENT_LANDED) audio.land();
    if (events & EVENT_OVER) {
      game.screen = 'over';
      if (s.reason.includes('TERRAIN') || s.reason.includes('OVERRAN') || s.reason.includes('FUEL')) audio.crash();
      announce(`Sortie over: ${s.reason}. Score ${s.score}.`);
    }
  }
  drawFrame(ctx, game, game.time);
  requestAnimationFrame(frame);
}
frame.last = 0;

// Screenshot mode: stage the scene once, draw it, and stop — the frame the
// maker captures is exactly what a short game really looks like.
if (shotName) {
  const mission = MISSIONS[(seedParam - 1) % MISSIONS.length] ?? MISSIONS[0];
  game.world = createWorld(mission.id);
  game.selectedMission = mission.id;
  game.screen = stageShot(shotName, game.world);
  drawFrame(ctx, game, 12);
  document.title = `Meridian Ridge Run — ${shotName}`;
} else {
  requestAnimationFrame(frame);
}
