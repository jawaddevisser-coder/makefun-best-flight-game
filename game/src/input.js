// Meridian Ridge Run — keyboard and mouse input, kept apart from the sim.
// Keys are read per frame; edge-triggered actions go through consumeAction.
const TRACKED = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'Enter', 'KeyP', 'KeyR', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Space',
];

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const clicks = [];

  function onKeyDown(event) {
    if (!TRACKED.includes(event.code)) return;
    event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    clicks.push({
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('click', onClick);

  const down = (code) => keys.has(code);

  return {
    // Continuous flight input for one step: roll/pitch in [-1, 1], throttle delta.
    flight() {
      const roll = (down('ArrowRight') || down('KeyD') ? 1 : 0)
        - (down('ArrowLeft') || down('KeyA') ? 1 : 0);
      const pitch = (down('ArrowUp') || down('KeyW') ? 1 : 0)
        - (down('ArrowDown') || down('KeyS') ? 1 : 0);
      const throttle = (down('ShiftLeft') || down('ShiftRight') ? 1 : 0)
        - (down('ControlLeft') || down('ControlRight') ? 1 : 0);
      return { roll, pitch, throttle };
    },
    // One-shot action keys, each reported once until pressed again.
    consumeAction() {
      for (const code of ['Enter', 'KeyP', 'KeyR', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Space']) {
        if (pressed.has(code)) {
          pressed.delete(code);
          return code;
        }
      }
      return null;
    },
    consumeClick() {
      return clicks.shift() ?? null;
    },
    clearPressed() {
      pressed.clear();
    },
  };
}
