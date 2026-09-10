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

## Miner rhythm

Run `node sky-stack/tests/miners.test.cjs` for cumulative level permissions, target
selection, material-specific beat windows, and duplicate-frame prevention. Dirt
hits on 1 and 3, stone on 2 and 4, and deepslate on the eighth-note offbeats after
2 and 4. Mining follows the audio clock, with a matching 72 BPM silent fallback.

The AI holds position while digging, prioritizes blocks within pick reach, and
backs away from targets after two stalled attempts. All levels can jump and grip
short walls; higher levels can climb taller ledges. Suspended audio uses the
silent beat clock so miners keep working.

With the game served locally and Playwright available, run
`SKY_TEST_URL=http://127.0.0.1:8765/sky-stack/ node sky-stack/tests/miners-browser.test.cjs`.
Optionally set `SKY_TEST_BROWSER` to an existing Chromium executable. This test
loads the production bundle in an isolated browser context and exercises real
Matter.js physics, harvesting, obstacle jumps, tall-wall climbing, unreachable
target recovery, live music, and audio suspension without touching your saves.

The v38 miner regressions also upgrade workers using the real menu beside mixed
materials, route around an overhang, and run six workers through a low tunnel.
Workers now select an eligible nearby material on each beat, plan routes between
clear standing positions, and stay upright while passing one another. Both the
main AI and the older nearby-mining helper retain lower-level material access.

## Trees


Trees have a one-block-wide 3–5 block trunk and a compact three-wide branched
leaf crown. They are rare landmarks, with a guaranteed starter tree in the first
surface chunk and a low chance in later chunks.
Cutting a trunk releases every log above the cut as a dynamic Matter.js body.
Detached leaves fade and disappear in 1–2 seconds without granting resources;
manually mined leaves and wood go into the toolbar and can be placed as blocks.
Natural trees never count toward tower height. Placed leaf blocks do not decay.

The `treesV41` save field stores generated tree chunks and the surviving natural
blocks, including falling positions and remaining decay time. Older saves gain
trees only on clear surface sites; chopped trees never regenerate on reload.

Run `SKY_TEST_URL=http://127.0.0.1:8765/sky-stack/ node sky-stack/tests/trees-browser.test.cjs`
with Playwright available. It covers generation, real-physics falls, valid body
mass, leaf decay, soil removal, save restoration, harvesting and toolbar placement.

## Miner ghosts

The v42 layer checks actual filled liquid cells: submerged heads drain five seconds
of air, while lava contact burns through 900 ms of tolerance. Surfacing restores
air. Death removes the physical worker and creates a saved ghost retaining its
identity, level and gold. Ghosts drift upward and sway, then hover above the world.
Tapping one with any tool revives it at its current position with 2.2 seconds of
protection. Manually released miners also leave ghosts, with already claimed gold
removed from their pockets. Audio adds chord-matched ghost phrases and eighth-note
death/revival cues to the existing score.

Run `SKY_TEST_URL=http://127.0.0.1:8765/sky-stack/ node sky-stack/tests/spirits-browser.test.cjs`
with Playwright available. It checks exposure, recovery, frame-rate independence,
ghost drift, save/reload accounting, click revival, retained upgrades/gold,
revival protection, drag/cancel behavior, manual releases and Web Audio cues.
