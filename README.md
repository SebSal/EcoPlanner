# ECO Build Planner

A lightweight, browser-based planner for designing block builds for the game
**[Eco](https://play.eco/)**. Lay out your build layer by layer in a top-down 2D
editor, watch it take shape in a live 3D preview, and keep an eye on exactly how
many blocks of each type you'll need — organised around Eco's **5×5 claim** grid.

> Everything runs client-side. Your work autosaves to your browser and can be
> exported to a JSON file to back up or share.

## Features

- **2D layer editor** — top-down grid for the current layer. Click to place,
  click a matching block again to remove it, and click-and-drag to paint a run.
- **3D preview** — an instanced Three.js view that updates as you build, with an
  orbit camera.
- **Claim-aware grid** — a heavier line every 5 blocks (one Eco claim) on both
  ground axes, in both the 2D and 3D views.
- **Build in claims** — new projects are sized in claims (1 claim = 5 blocks).
- **Grow upward** — builds start one layer tall; the ▲ Up button adds layers as
  you go, so you never have to guess the height in advance.
- **Show layer below** — a ghost of the layer beneath the current one to help
  you line things up.
- **Erase tool** — switch modes to clear blocks.
- **Block tally** — a live count of placed blocks by type, with a running total.
- **Export / Import** — save a project to JSON and load it back later.
- **Autosave** — the current build is saved to `localStorage` automatically.

## Coordinates

The ground plane is **X (width)** and **Z (depth)**; **Y** is the vertical axis
(the stack of layers you edit one at a time). In Eco terms: X/Y are the ground,
and height is the axis you grow with ▲ Up.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) (dev server + build)
- [Three.js](https://threejs.org/) via
  [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) and
  [@react-three/drei](https://github.com/pmndrs/drei)
- [Zustand](https://github.com/pmndrs/zustand) + [Immer](https://immerjs.github.io/immer/) for state
- [Oxlint](https://oxc.rs/docs/guide/usage/linter) for linting

## Getting started

**Requirements:** Node.js **20.19+** or **22.12+** (required by Vite 8). Check with
`node -v`; if you're older, [nvm](https://github.com/nvm-sh/nvm) makes upgrading
easy (`nvm install 22`).

```bash
npm install      # install dependencies
npm run dev      # start the dev server → http://localhost:5173
```

### Scripts

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with hot reload           |
| `npm run build`   | Type-check (`tsc -b`) and build to `dist/`          |
| `npm run preview` | Serve the production build locally                  |
| `npm run lint`    | Run Oxlint                                           |

## Project structure

```
src/
├── components/
│   ├── editor2d/     # 2D layer editor + layer selector
│   ├── viewer3d/     # 3D scene and instanced voxel mesh
│   ├── toolbar/      # tools, block palette, new-project dialog, export/import
│   └── layout/       # app shell + block-count footer
├── state/            # Zustand store (the single source of truth)
├── lib/              # voxel grid helpers + persistence (autosave, export/import)
├── data/             # block palette (ids, names, colors)
└── types/            # shared TypeScript types
```

## Deployment

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
builds the app and publishes it to **GitHub Pages** on pushes to `main`.

## Notes & limitations

- The block palette uses **placeholder** colors, not exact in-game materials.
- Grid dimensions are set when a project is created and can't be resized
  afterwards (except growing height upward with ▲ Up).
