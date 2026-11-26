// Meridian Ridge Run — small synthesised sounds, no audio files.
// Everything is built with WebAudio oscillators, and nothing runs until the
// player has pressed a key or clicked, so headless screenshots stay silent.
export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      wind.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, when, dur, type, vol) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur);
    } catch {
      /* sound is decoration; a failure never stops the game */
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    engine(throttle, speed) {
      if (!ctx || muted) return;
      try {
        engine.frequency.value = 42 + throttle * 70 + speed * 0.25;
        engineGain.gain.value = 0.02 + throttle * 0.05;
        windGain.gain.value = Math.min(0.06, speed * 0.0004);
      } catch {
        /* ignore */
      }
    },
    ring(perfect) {
      blip(880, 0, 0.18, 'sine', 0.22);
      blip(perfect ? 1318 : 1108, 0.09, 0.28, 'sine', 0.22);
    },
    crash() {
      blip(90, 0, 0.5, 'square', 0.25);
      blip(55, 0.05, 0.7, 'sawtooth', 0.2);
    },
    land() {
      blip(523, 0, 0.15, 'sine', 0.18);
      blip(659, 0.12, 0.15, 'sine', 0.18);
      blip(784, 0.24, 0.3, 'sine', 0.2);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
