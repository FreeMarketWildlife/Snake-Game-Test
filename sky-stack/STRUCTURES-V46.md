# Structures and nailed foundations — v46

Craft the first Workshop in the Structures toolbar panel for **5 wood, 5 dirt, 10 stone**.
Open the house slot in the toolbar and **drag a structure card into the world**.
Release a green preview to place it. Clicking a card alone does not place it.
The whole base must sit on fixed world terrain or nailed player blocks, with
an empty footprint. Structure placement always uses the block grid.

| Building | Footprint | Construction cost | Production |
| --- | --- | --- | --- |
| Workshop | 4 × 4 | 5 wood, 5 dirt, 10 stone | Workshop, Forge, Blacksmith; 5 seconds each |
| Forge | 3 × 3 | 15 stone, 5 wood, 5 dirt | 1 iron/copper ore + 1 coal → 1 corresponding ingot; 4 seconds |
| Blacksmith | 5 × 4 | 15 wood, 10 stone, 3 iron ingots | 1 iron ingot → 10 nails; 4 seconds |

Click a placed building to open its recipe, progress, pause and repeat controls.
Every building operates independently. Inputs are reserved at batch start;
finished goods enter shared inventory, with buildings in the structures bag.
Packing a building returns it to the bag and refunds reserved batch ingredients.
There is no offline production. Existing purchased Furnaces migrate into one
Forge inventory item; any reserved ingredients are returned once.

NAILS ON spends one nail and one material per grid cell. Nailed placements
must share an edge with world terrain or an existing nailed block. Each cell
becomes its own static body, with visible nail heads and persisted fixed state.
Removing the last world connection makes unsupported nailed blocks fall, except
when doing so would undermine a placed building: those supports are protected.
Both player and miner harvesting honor that protection; miners skip protected
work targets. A building must be packed before its necessary support is removed.

Buildings have static compound physics bodies derived from their opaque sprite
pixels, including stepped roofs, chimneys, and footings. Falling blocks land on
these surfaces. Animated smoke and flames do not affect collision geometry.
Colliders are rebuilt on load and removed when buildings are packed. Leaves never
count as fixed support, including nailed leaves. Ordinary blocks cannot be placed into their solid artwork, but transparent
corners remain open. Shop clicking uses the same silhouette. Doors
are approximately one miner tall. Pixel art is cached at one pixel per world unit,
with live workshop tools, forge flames, and chimney smoke layered over it.

Implementation: `game-v46-structures.txt`, `game-v46-structure-art.txt`, and
`style-v46-structures.css`, assembled by the existing loader. Both save paths
include structure data and nailed flags, including captured autosave callbacks.

Validation: `tests/structures-browser.test.cjs` covers real mouse/touch dragging,
click/cancel safety, costs and inventory, overlap/support rules, crafting,
independent production, frame-rate parity, pause and supply waiting, mid-job
reload, packing refunds, nailed adjacency and save restoration, protected
foundation chains, old Furnace migration, and desktop/mobile shop geometry.
Existing industry tests retain ore harvesting and machine-audio coverage.

## Structures panel and pixel standard — v48

The house toolbar button toggles a non-modal panel immediately above the toolbar.
It contains Workshop crafting, draggable structure inventory, and live industry
resource counts. Outside clicks and Escape dismiss it. Industry no longer has a
separate HUD button.

UI miniatures are authored at 32 × 32 pixels and rendered at native resolution.
They are separate drawings, not reduced world sprites. Existing UI icons and shop
portraits also use native art pixels; world sprites retain the camera's shared
zoom. New controls use raster pixel icons rather than emoji or font symbols.
See the repository AGENTS.md for continuing art requirements.

## Workshop grid — v50

The Workshop uses a grid of structure cards. Each card shows a native-size pixel
miniature, footprint, and material icons with required quantities. One click/tap
starts one five-second craft. Cards indicate shortages and lock during a job.
Finished structures enter the Structures inventory. Building repeat controls are
removed; saved repeat settings reset to off on load. Existing in-progress jobs
and manual pause/resume remain available.
