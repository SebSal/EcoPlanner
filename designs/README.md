# Designs

Ready-made builds, saved in the planner's own project format. To open one:

1. Download the `.json` file from this folder.
2. In the planner, click **Import** and pick it.

Importing replaces whatever is currently on the grid (and overwrites the
autosave), so export your own work first if you want to keep it.

---

## The bridges

Three takes on the same brief — **30 claims (150 blocks) long, 12 blocks wide**,
with an 8-lane asphalt roadway between two stone road edges on layer 11. They
share a deck and differ entirely in what carries it.

| | Style | Tallest | Blocks | Head room |
| --- | --- | --- | --- | --- |
| [`bridge-30-claims-arch.json`](bridge-30-claims-arch.json) | Three steel through-arches on stone piers | layer 24 | 7344 | 6 |
| [`bridge-30-claims-truss.json`](bridge-30-claims-truss.json) | Continuous Warren through-truss | layer 20 | 6958 | 8 |
| [`bridge-30-claims-cable-stayed.json`](bridge-30-claims-cable-stayed.json) | Twin H-pylons with fanned stays | layer 31 | 7042 | 6 |

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
| 9 | 8 | Flat Steel girders at `x = 1, 4, 7, 10`, plus the pier caps. |
| 1–8 | 0–7 | Piers, bents and the Ashlar Basalt abutments at both ends. |

If your terrain already reaches deck height at the ends, erase the abutments
(the first and last 3 blocks of `z`, below layer 9).

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
| Reinforced Concrete | 2448 |
| Asphalt Road | 1200 |
| Ashlar Basalt | 1056 |
| Flat Steel | 1046 |
| Ashlar Granite | 648 |
| Corrugated Steel | 388 |
| Stone Road | 300 |
| Steel Pipe | 258 |
| **Total** | **7344** |

---

## `bridge-30-claims-truss.json` — Warren through-truss

The most steel of the three, and the cheapest to build. A single truss runs
almost the whole span (`z = 3` to `z = 146`) on each side: bottom chord on the
curb at layer 12, top chord at layer 20, and a zig-zag web of 45° diagonals with
verticals every 8 blocks at the panel points. Corrugated Steel sway braces cross
overhead at each panel, 8 blocks clear of the roadway.

The truss doubles as the parapet, so there's no separate railing — only short
Corrugated Steel fence stubs closing the deck outside the truss ends. Below, six
Reinforced Concrete twin-leg bents at 25-block spacing.

| Block | Count |
| --- | --- |
| Reinforced Concrete | 2904 |
| Flat Steel | 1546 |
| Asphalt Road | 1200 |
| Ashlar Basalt | 816 |
| Stone Road | 300 |
| Corrugated Steel | 192 |
| **Total** | **6958** |

---

## `bridge-30-claims-cable-stayed.json` — twin H-pylons

The landmark option, and the tallest. Two Flat Steel towers at `z = 44` and
`z = 105` rise from Ashlar Granite piers to layer 31 — 20 blocks above the deck —
with Corrugated Steel cross-beams tying each pair of legs at layers 18 and 30.
Four levels of Steel Pipe stays fan out both ways from each tower, anchoring
along the deck edge at 10, 18, 26 and 34 blocks out.

The main span between the towers is 61 blocks; back spans run on concrete bents
at `z = 12, 77, 137`. Corrugated Steel fence railings run the full deck.

| Block | Count |
| --- | --- |
| Reinforced Concrete | 2602 |
| Asphalt Road | 1200 |
| Ashlar Basalt | 896 |
| Flat Steel | 740 |
| Steel Pipe | 668 |
| Corrugated Steel | 348 |
| Stone Road | 300 |
| Ashlar Granite | 288 |
| **Total** | **7042** |
