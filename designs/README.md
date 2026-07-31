# Designs

Ready-made builds, saved in the planner's own project format. To open one:

1. Download the `.json` file from this folder.
2. In the planner, click **Import** and pick it.

Importing replaces whatever is currently on the grid (and overwrites the
autosave), so export your own work first if you want to keep it.

---

## `bridge-30-claims.json` — Bridge, 30 claims

A three-span steel through-arch bridge on stone piers: **30 claims (150 blocks)
long**, **12 blocks wide**, 24 layers tall, 7344 blocks.

### Roadway — layer 11

```
x:   0      1        2  3  4  5  6  7  8  9        10       11
   curb   stone   ←——— 8 x Asphalt Road ———→     stone     curb
```

The curbs are Reinforced Concrete: they exist so the railings (Corrugated Steel,
Fence shape) have something of their own to stand on instead of sitting on the
stone roads.

### Layer map

| Layer | y | What's there |
| --- | --- | --- |
| 12–24 | 11–23 | Arch ribs, hangers, portal bracing and the entrance gateways — all of it out at `x = 0` / `x = 11` or high overhead. |
| 12 | 11 | Railings on the curbs; arch springings; gateway posts. |
| 11 | 10 | Driving surface — the cross-section above. |
| 10 | 9 | Reinforced Concrete deck slab, full width, full length. |
| 9 | 8 | Flat Steel girders at `x = 1, 4, 7, 10`, plus the pier caps. |
| 2–8 | 1–7 | Pier shafts, approach-bent legs, abutment bodies. |
| 1 | 0 | Footings. |

**Head clearance:** nothing at all sits over the roadway between layers 12 and
17. The lowest overhead piece is the gateway lintel on layer 18, so the driving
surface has 6 clear blocks above it end to end.

### Structure

Three arches of 35 blocks each, springing from the deck at `z = 22, 57, 92, 127`
— the centres of the four main piers — and rising 12 blocks to a crown on layer
24. The ribs are Flat Steel; Steel Pipe hangers drop from them to the deck edge
every 5 blocks, and Corrugated Steel portal beams brace the two ribs across the
top of each span.

Below the deck: main piers are Ashlar Granite shafts on Ashlar Basalt footings.
The approach spans at each end run on lighter Reinforced Concrete twin-leg bents
at `z = 7` and `z = 142`, and land on Ashlar Basalt abutments 3 blocks deep.

At each end, Ashlar Granite gateway posts rise off the curbs with a Flat Steel
lintel across the roadway.

If your terrain already reaches deck height at the ends, erase the abutments
(the first and last 3 blocks of `z`, below layer 9).

### Materials

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
