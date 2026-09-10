# Industry and musical automation — v44

This update extends the existing Sky Stack game and its `skyStack.save.v1` save.
It introduces the first mining-to-smelting loop without replacing terrain,
inventory, physical workers, tower building, or the procedural soundtrack.

## Files

Added:

- `sky-stack/game-v44-industry-resources.txt`: resource definitions, terrain payloads,
  ore rendering and payouts, Furnace state and production, Industry UI integration,
  save restoration, and the future positioned-machine registry.
- `sky-stack/style-v44-industry.css`: responsive Industry panel and resource icons.
- `sky-stack/tests/industry-browser.test.cjs`: real assembled-game Industry tests.
- `sky-stack/tests/automation-audio.test.cjs`: deterministic audio-clock stress tests.
- `sky-stack/INDUSTRY-V44.md`: this implementation and verification report.

Modified:

- `sky-stack/index.html`: Industry button/dialog, resource counts, Furnace controls,
  Field Guide entry, stylesheet and release cache versions.
- `sky-stack/game-v28.js`: loads the new module and updated assets.
- `sky-stack/game-v8-part1.txt` and `sky-stack/game-v10-liquid.txt`: include Furnace
  state in both existing save paths, including captured autosave/page-hide callbacks.
- `sky-stack/game-v27-miner-ai-rhythm.txt`: extracts the existing camera/zoom gain
  and pan calculation into `worldAudioSpatialV44`; miners keep their original wrapper.
- `sky-stack/audio.js`: central machine patterns, lookahead scheduling, a quiet
  automation bus, chord-derived notes, bounded voices, grouped miner percussion,
  harmony-aware coin cues, and debug data.
- `sky-stack/game-v28-resources-obsidian.txt`: all miner levels use the spatial
  coin cue; original pocket/share and diamond payouts remain intact.
- `sky-stack/game-v41-trees.txt`: restores each leaf's saved tree ID. Regression
  testing found that side leaves were previously reassigned to separate trees.
- `sky-stack/tests/README.md`: new test commands and behavior documentation.

## Resources and deposits

Raw resources: `coal`, `ironOre`, `copperOre`.
Processed resources: `ironIngot`, `copperIngot`.
No lumber or oil is introduced.

| Deposit | Base terrain | Inclusive depth in block rows | Yield |
| --- | --- | --- | --- |
| Coal | Dirt or stone | 4–25 | 1 |
| Iron ore | Stone | 8–27 | 1; a deterministic 25% chance of 2 at row 16+ |
| Copper ore | Stone or deepslate | 14–35 | 1 |

`ORE_DEFS_V44` controls these ranges, materials, salts, vein radii, and density.
Deposits use the existing `hash01` over eight-cell regions, with small clusters
and one industrial resource payload per terrain cell. They do not create new
Matter.js materials. Exposed deposits show small colored pixel flecks over their
normal terrain art; buried deposits are not revealed through solid rock.

Both manual and miner harvesting retain existing exposure and hardness rules.
The original material payout still occurs; the embedded resource is added to
`inv` before the existing harvest/save path runs. No ore is automatically refined.
Repeated harvesting of an already removed body cannot duplicate the payout.
Short floating labels combine nearby common finds rather than opening giant toasts.

Miner eligibility follows the base terrain: level 1 dirt, level 2 adds stone,
level 3 adds deepslate. Gold pocketing/sharing and diamond banking are retained.

## Furnace and UI

The compact Industry button sits opposite the pickaxe upgrade button above the
building toolbar. Its scrollable modal contains the five industrial inventory
counts and Furnace controls. Industrial resources have no placement toolbar slots.

Build one global Furnace for **10 stone + 5 wood**. There is no physical factory
body and no invented world position. Both configurable recipes take four seconds:

- 1 iron ore + 1 coal → 1 iron ingot.
- 1 copper ore + 1 coal → 1 copper ingot.

Inputs are reserved at the start of a batch. Output is deposited once at completion.
Pause holds a batch without refunding or consuming more inputs. Recipe selection
is fixed while a batch is active. Auto-repeat waits when supplies run out and
resumes when they return; switching auto off lets the current batch finish.

The existing inventory spread persists all five resources. Missing values in old
saves default to zero. `industryV44` stores the purchase, selected recipe, auto and
pause flags, current batch and remaining milliseconds, plus a wall-clock save
timestamp for future offline support. This version does not process offline time:
hidden tabs and reloads resume the stored remaining duration. Frame remainders
are retained between batches so throughput does not depend on frame rate.

## Musical automation

`MACHINE_AUDIO` centralizes patterns, bar sparsity, gain, duration, timbre,
chord-tone/octave selection, and per-type voice caps. The active global Furnace
adds a quiet low metallic pulse on beat 1. Idle or paused Furnaces are silent.
Sawmill/stonecutter audio definitions prepare complementary rhythmic roles only;
those gameplay facilities are not implemented.

Machine scheduling runs from the existing central audio scheduler against the
same AudioContext beat origin and 72 BPM score. Its short lookahead schedules
notes at exact sixteenth-grid times. Notes derive from the scheduled bar's actual
SONG chord. Identical machines share one combined voice with a capped, sub-linear
count accent. There is also a six-voice global ceiling and a quiet automation bus
feeding the existing master compressor.

Physical machines can register/update coordinates through `SkyMachines.update`
and be removed with `SkyMachines.remove`. Gain and pan use the same smooth,
zoom-aware viewport falloff as miners. The global Furnace is intentionally subtle
and non-spatial. Actual miner hits retain their gameplay beat windows; same-frame
strikes are grouped, with nearer workers determining the mix. No audio state can
prevent production or mining. Missed audio slots are skipped after suspension.

`__skyStackAudioDebug().automation` exposes clock/grid state, definitions, mix,
recent scheduled notes, and active voices. `__skyStackIndustryDebug()` reports
inventory, Furnace state, ore rules, and musical diagnostics without normal UI clutter.

## Verification

New browser checks cover deterministic deposits across thousands of coordinates,
geology/depth constraints, manual and miner payouts, hit requirements, duplicate
harvest prevention, purchase costs, input reservation, exact batch completion,
mid-batch reload, inventory persistence, auto waiting/resumption, coal exhaustion,
pause, both recipes, 30/60/144 FPS throughput, old saves, mobile layout, actual Web
Audio execution, shared gain/pan, and zoom.

The audio test simulates five minutes and 100 identical active facilities, verifying
exact grid timing, chord selection, bounded volume/voices, idle/distant silence,
and no backlog after hidden/suspended periods. Existing miner, liquid, dev-panel,
tree, pickaxe, and ghost regression suites pass, including their browser checks.
Desktop/mobile Industry views and ore rendering are inspected visually.

## Limits and next step

One global Furnace, two recipes, no offline processing, no physical factory
placement, no logistics, and no ingot spending sinks yet. New deposits are derived
on still-existing terrain in old worlds; removed blocks stay removed. The tree
restore fix preserves properly saved tree IDs but cannot infer a correct old root
for leaves that were already saved under the wrong ID by an earlier release.

Next: **oil extraction and refining**. Add deterministic liquid reservoirs,
discovery, a physical Derrick registered with the shared audio system, a crude-oil
inventory resource, and refinery recipes using the existing generic resource grant
and recipe structures. That future update should give ingots their first spending
purpose through industrial construction costs.
