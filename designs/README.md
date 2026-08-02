# Designs

Ready-made builds, saved in the planner's own project format. To open one:

1. Download the `.json` file from this folder.
2. In the planner, click **Import** and pick it.

Importing replaces whatever is currently on the grid (and overwrites the
autosave), so export your own work first if you want to keep it.

---

## The Colosseum

At **1 block = 1 metre**, the real building is 189 × 156 m on plan, 48 m tall,
with an 87 × 55 m arena and 80 arches per storey on ~6.8 m bays. Both files below
are built from those numbers; they differ only in scale.

| | Plan | Height | Arena | Arches | Blocks | Autosave |
| --- | --- | --- | --- | --- | --- | --- |
| Real building | 189 × 156 m | 48 m | 87 × 55 m | 80 | — | — |
| [`colosseum-1to1.json`](colosseum-1to1.json) | 189 × 156 | 48 | 87 × 54 | 80 | 127,614 | ✗ **exceeds the browser limit** |
| [`colosseum.json`](colosseum.json) | 117 × 97 | 30 | 53 × 33 | 50 | 48,043 | ✓ 80% of the limit |

**Which to use.** `colosseum-1to1.json` is the building at true scale — every
dimension matches, and the 6.8 m bay gives the full 80 arches. It imports and
renders, but at 10.6 M characters it is **2.15× the browser's ~4.94 M
`localStorage` ceiling**, so autosave fails outright: nothing is stored, and
refreshing the page loses it. It also takes ~25 s to import. Treat it as a
reference model, and re-import it each session.

`colosseum.json` is the same building at 62% — 117 × 97 × 30 m. The proportions
are exact (1.21 plan ratio, 0.26 height-to-length, same as the original) and the
bays are still a true 6.8 m, so piers and openings keep their built proportions;
there are simply 50 arches around a shorter perimeter instead of 80. This is the
one to actually work with.

### The facade

Each bay is a ~2.6 m pier carrying a ~4.2 m arched opening, as built. The arch
head is **Understairs** blocks springing off both piers for the stepped soffit,
with an Ashlar Limestone **keystone** in the crown course. A **Column** stack
runs up every pier as an engaged half-column — one per bay per storey, growing
its own base and capital from the neighbour-aware mesh — and an **Underbrace**
corbel carries the cornice above each one. Limestone string courses close each
storey, and the attic alternates **Window** and **Double Window** blocks under a
crowning cornice.

The facade is full depth on the piers and thinner across the spandrels, which is
both how it was built and a large saving in blocks.

### Inside

| Ring | What's there |
| --- | --- |
| Facade | 3 m deep on the piers |
| Ambulatory | 8 m wide, with Brick vault decks at the first two storey levels |
| Inner arcade wall | Arched at the lower two storeys, carrying the top of the seating |
| Cavea | Seating from the podium up to just above the third cornice |
| Arena | Sanded over half; the other half open over the hypogeum |

The cavea is one seat row per metre, laid in **Stairs** blocks stepping down
toward the arena, with flat Ashlar Limestone praecinctiones every few rows and
radial vomitoria aisles every eighth bay. A limestone podium wall rings the
arena, topped with a **Fence** balustrade. Beneath the arena floor is the Brick
hypogeum, left exposed on one half as the ruin stands today.

### Shapes

Ashlar's full catalogue was checked against the meshes in `public/meshes` rather
than assumed. In use: **Cube, Column, Understairs, Underbrace, Stairs, Fence,
Window, Double Window**. Deliberately unused: `flatroof`, `floor` and `fullwall`
extract as plain boxes in this family, so they render identically to Cube;
`brace` / `sidebrace` are the same bracket as `underbrace`; the slope and peak
families (`halfslope*`, `basicslope*`, `underslope*`, `peakset`) are pitched-roof
geometry with nothing to do at an arcade; `wall` is a half-depth panel, which
would undercut piers that need full depth.

---

## The bridges

Three takes on the same brief — **30 claims (150 blocks) long, 12 blocks wide**,
with an 8-lane asphalt roadway between two stone road edges on layer 11. They
share a deck and differ entirely in what carries it.

| | Style | Tallest | Blocks | Head room |
| --- | --- | --- | --- | --- |
| [`bridge-30-claims-arch.json`](bridge-30-claims-arch.json) | Three steel through-arches on stone piers | layer 24 | 7574 | 6 |
| [`bridge-30-claims-truss.json`](bridge-30-claims-truss.json) | Continuous Warren through-truss | layer 20 | 7282 | 8 |
| [`bridge-30-claims-cable-stayed.json`](bridge-30-claims-cable-stayed.json) | Twin H-pylons with fanned stays | layer 31 | 7330 | 6 |

"Head room" is the clear blocks above the driving surface — the brief asks for at
least 5, and all three beat it. Nothing sits over the roadway below those
heights; every rib, stay, post and tower leg is on the curb columns at `x = 0`
and `x = 11`, outside the 10-block roadway.

### The shared deck

```
x:   0      1        2  3  4  5  6  7  8  9        10       11
   curb   stone   ←——— 8 x Asphalt Road ———→     stone     curb
```

| Layer | y | What's there |
| --- | --- | --- |
| 11 | 10 | Driving surface — the cross-section above. The curbs exist so the barrier has its own block instead of standing on the stone roads. |
| 10 | 9 | Reinforced Concrete deck slab, full width, full length. |
| 9 | 8 | Flat Steel girder webs (Wall shape) at `x = 1, 4, 7, 10`, a bevelled Roof Side fascia along both deck edges, and the pier caps. |
| 1–8 | 0–7 | Piers, bents and the Ashlar Basalt abutments at both ends. |

Pier caps are chamfered at both ends with Roof Side wedges and flare into the
shaft below; the abutments step into the deck with a Half Slope B top course.

If your terrain already reaches deck height at the ends, erase the abutments
(the first and last 3 blocks of `z`, below layer 9).

### A note on shapes

These aren't cube builds. Roof Side wedges smooth every 45° run — the arch
extrados, the truss web, the pier caps, the deck fascia. Girders and the truss
top chord are thin Wall panels. Posts, tower shafts and gateway columns use the
Column shape, which grows its own base and capital from the stack. Railings are
neighbour-aware Fences, and the stays and hangers are Pipes.

---

## `bridge-30-claims-arch.json` — steel through-arch

Three arches of 35 blocks, springing from the deck at `z = 22, 57, 92, 127` — the
centres of the four main piers — and rising 12 blocks to a crown on layer 24. The
ribs are Flat Steel; Steel Pipe hangers drop to the deck edge every 5 blocks, and
Corrugated Steel portal beams brace the ribs across the top of each span.

Main piers are Ashlar Granite shafts on Ashlar Basalt footings. The approach
spans run on Reinforced Concrete twin-leg bents at `z = 7` and `z = 142`. Ashlar
Granite gateway posts with a Flat Steel lintel frame each end of the roadway.

| Block | Count |
| --- | --- |
| Reinforced Concrete | 2640 |
| Flat Steel | 1220 |
| Asphalt Road | 1200 |
| Ashlar Basalt | 1056 |
| Ashlar Granite | 504 |
| Corrugated Steel | 396 |
| Stone Road | 300 |
| Steel Pipe | 258 |
| **Total** | **7574** |

---

## `bridge-30-claims-truss.json` — Warren through-truss

The most steel of the three, and the cheapest to build. A single truss runs
almost the whole span (`z = 3` to `z = 146`) on each side: bottom chord on the
curb at layer 12, a thin Wall-panel top chord at layer 20, and a zig-zag web of
solid 45° Roof Side wedges with Column posts every 8 blocks at the panel points.
Corrugated Steel sway braces cross overhead at each panel, 8 blocks clear of the
roadway.

The truss doubles as the parapet, so there's no separate railing — only short
Corrugated Steel fence stubs closing the deck outside the truss ends. Below, six
Reinforced Concrete twin-leg bents at 25-block spacing.

| Block | Count |
| --- | --- |
| Reinforced Concrete | 2928 |
| Flat Steel | 1846 |
| Asphalt Road | 1200 |
| Ashlar Basalt | 816 |
| Stone Road | 300 |
| Corrugated Steel | 192 |
| **Total** | **7282** |

---

## `bridge-30-claims-cable-stayed.json` — twin H-pylons

The landmark option, and the tallest. Two Flat Steel towers at `z = 44` and
`z = 105` rise from Ashlar Granite piers to layer 31 — 20 blocks above the deck.
Each leg is a 1 × 3 shaft fluted by a Column down its middle, shouldered with
Roof Side wedges into a single Column finial, and Corrugated Steel Wall beams tie
each pair of legs at layers 18 and 30.
Four levels of Steel Pipe stays fan out both ways from each tower, anchoring
along the deck edge at 10, 18, 26 and 34 blocks out.

The main span between the towers is 61 blocks; back spans run on concrete bents
at `z = 12, 77, 137`. Corrugated Steel fence railings run the full deck.

| Block | Count |
| --- | --- |
| Reinforced Concrete | 2646 |
| Asphalt Road | 1200 |
| Flat Steel | 1024 |
| Ashlar Basalt | 896 |
| Steel Pipe | 676 |
| Corrugated Steel | 348 |
| Stone Road | 300 |
| Ashlar Granite | 240 |
| **Total** | **7330** |
