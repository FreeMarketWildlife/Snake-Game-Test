# Liquid development

Serve the repository with `python3 -m http.server 8765 --bind 127.0.0.1`.

- Game: http://localhost:8765/sky-stack/
- Isolated liquid playground: http://localhost:8765/sky-stack/tests/liquids.html
- Regression checks: `node sky-stack/tests/liquids.test.cjs`

The playground loads the real v22 storage/helpers and v29 solver/renderer in a small
fixture world. It does not access game saves. Springs deliberately add liquid;
closing the playground dam removes liquid inside its newly solid cells. Turn off
springs to inspect settling. Water/lava reaction is tested separately against the
production v28 reaction; the two playground tanks stay separate.

The production loader appends v29 after the v28 resource patch so the existing
obsidian behavior and saved-world format are retained. The v29 changes use a 60 Hz
liquid clock, conservative downward/lateral/pressure transfers, slower lava, and
one offscreen pixel layer to avoid overlapping translucent cell seams. Simulation
continues in the existing horizontal activity range around the camera.

## Dev panel

Open the lightbulb and choose Dev Tools, or press F2. Escape closes the panel.
Gold additions and height records save immediately. Height changes update building
size and height-based unlocks; existing miners are retained when lowering a record.
One-hit mining bypasses exposure/material locks, including bedrock. Unlimited
miners can be placed from the toolbar, and direct spawn controls support levels 1–3.
Cheat switches reset on reload; spawned miners remain in the ordinary world save.

Run `node sky-stack/tests/dev-panel.test.cjs` for dev-control regressions. Browser
verification used port 8766 as a separate save origin from the normal 8765 preview.

## Art direction

`tests/art.html` displays actual terrain sprites (exposed, buried, and damaged),
miner tiers, and tools. `tests/mobile.html` embeds the game in a 390 × 844 viewport
for checking the responsive UI. The game uses cached 32 px terrain sprites, with
uncached small animated miners, pixel damage marks and gold effects. The v32 UI
stylesheet covers the toolbar, HUD, tips, all confirmation/miner dialogs, and dev
panel. Rendering changes do not change collision bodies or progression rules.

## Field guide and audio

The lightbulb opens a compact native-details field guide. Restart World and Dev
Tools remain in its fixed footer, so neither action depends on scrolling. The Dev
button no longer occupies the game HUD. The score in `audio.js` is a 12-bar,
72-BPM MIDI-note arrangement rendered by Web Audio oscillators. Wind and birds
are procedurally generated on a separate ambience bus at a much lower gain.
