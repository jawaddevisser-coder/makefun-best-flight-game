# Meridian Ridge Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/jawaddevisser-coder/makefun-best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/jawaddevisser-coder/makefun-best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A dawn flight game for the [best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057) bounty on make.fun.

## The game

**Meridian Ridge Run** is a complete, original flight game that runs offline in a desktop browser from static files. You fly a little jet over a procedurally built valley at dawn — patchwork fields, a winding river, forested ridges and snow-capped mountains — chasing glowing rings, minding your fuel, and putting her down on the strip before the clock runs out.

- **Three sorties**: Ring Run (10 rings, 180 s), Canyon Slalom (12 tight gates low over the river, 150 s), Dawn Patrol (8 rings, then land before the tanks run dry).
- **Chase view** with a banking aircraft, lit instruments, and a full HUD: altitude, airspeed, heading, compass tape, artificial horizon, throttle and fuel.
- **Arcade flight model**: bank to turn, pitch to climb and dive, throttle discipline matters — climbing bleeds speed, diving gains it, and a hard arrival on anything but the runway ends the sortie.
- **Synthesised sound** (WebAudio, no files): engine hum, wind, ring chimes, landing fanfare.
- **Deterministic screenshots**: `?shot=start|play|end&seed=N` plays the real rules forward with an autopilot, so every screenshot is a frame a real game produces.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Pitch and roll |
| Shift / Ctrl | Throttle up / down |
| 1–3, Enter | Pick a mission and fly |
| P | Pause |
| R | Restart the sortie |
| M | Back to missions |
| Click | Pick a mission on the title screen |

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` through any static server. No network request is made by the game.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's vendored `vendor/makefun-game.ts` library.

## Layout

```
main.ts            hand-in program (Node 22, stdlib only)
game/
  index.html       canvas page, loads the game
  src/
    config.js      tuning constants and the three missions
    random.js      seeded PRNG and value noise for the valley
    world.js       terrain, ring course, flight model
    render.js      sky, projected terrain, aircraft, HUD, menus
    input.js       keyboard and mouse
    audio.js       synthesised engine, wind and chimes
    shots.js       deterministic screenshot scenes + autopilot
    main.js        boot, loop and screen flow
screenshots/        3 renders of the game's own code in a browser
vendor/
  makefun-game.ts  kit library, unchanged
```
