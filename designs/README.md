# Designs

Ready-made builds, saved in the planner's own project format. To open one:

1. Download the `.json` file from this folder.
2. In the planner, click **Import** and pick it.

Importing replaces whatever is currently on the grid (and overwrites the
autosave), so export your own work first if you want to keep it.

---

## `colosseum.json` — the Roman Colosseum

An elliptical amphitheatre, **139 × 117 blocks** (29 × 25 claims) and 30 layers
tall, in 50,377 blocks — mostly Ashlar Sandstone, with Ashlar Limestone for the
cornices and walkways and Brick for the Roman substructure.

### The facade

64 arcade bays in three storeys, then an attic. Every bay is a 3-block pier
carrying a 3-block arched opening: **Understairs** blocks springing off both
piers give the arch its stepped soffit, an Ashlar Limestone **keystone** sits in
the crown course, and a **Column** stack runs up the pier as an engaged
half-column — one per bay per storey, each growing its own base and capital from
the neighbour-aware mesh. Limestone string courses band the facade at layers 8,
15 and 22, and the attic carries a **Window** block in every other bay under a
crowning cornice at layer 30.

### Inside

| Ring | What's there |
| --- | --- |
| Facade | 2 blocks thick, layers 1–30 |
| Ambulatory | 6 blocks wide, with Brick vault decks at layers 8 and 15 |
| Inner arcade wall | Arched at the lower two storeys, carrying the top of the seating |
| Cavea | 27 rows of seating stepping from layer 25 down to layer 8 |
| Arena | 67 × 45 blocks |

The cavea is banded in limestone every seventh row for the praecinctiones — the
walkways dividing the tiers — and cut by radial vomitoria aisles every eighth
bay, which is what gives the bowl its spoked look from above.

The arena is sanded (Dirt Road) over half its area; the other half is left open
to show the **hypogeum**, the Brick grid of service corridors under the floor,
exactly as the ruin stands today. A limestone podium wall separates it from the
first row of seats.

| Block | Count |
| --- | --- |
| Ashlar Sandstone | 28,600 |
| Ashlar Limestone | 10,902 |
| Brick | 10,015 |
| Dirt Road | 860 |
| **Total** | **50,377** |

> **Heads up:** at ~4.1 MB this project is close to the browser's ~5 MB
> `localStorage` ceiling. It imports and autosaves fine, but there isn't room to
> add a great deal more before autosave starts failing — export to a file if you
> extend it.

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
