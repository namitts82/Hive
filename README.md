# Hive 🐝 — Mind Mapping Tool

[![CI](https://github.com/namitts82/Hive/actions/workflows/ci.yml/badge.svg)](https://github.com/namitts82/Hive/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/namitts82/Hive/actions/workflows/pages.yml/badge.svg)](https://github.com/namitts82/Hive/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/github/license/namitts82/Hive)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/namitts82/Hive)](https://github.com/namitts82/Hive/commits/main)
[![Code size](https://img.shields.io/github/languages/code-size/namitts82/Hive)](https://github.com/namitts82/Hive)
[![No build](https://img.shields.io/badge/build-none-brightgreen)](#run-it)
[![Vanilla JS](https://img.shields.io/badge/vanilla-JS-yellow)](#)

A browser-based mind mapping tool. Pure HTML + CSS + vanilla JavaScript — no build step, no backend, no telemetry. Maps are saved as portable, diff-friendly `.hmap.json` files.

## Run it

Just open `index.html` in any modern browser:

```pwsh
start index.html
```

Or serve the folder for the File System Access API to work in Chrome/Edge:

```pwsh
npx --yes http-server . -p 5173
# then open http://localhost:5173
```

## Features

- **Visual editor** — radial, horizontal-tree, vertical-tree, and free layouts
- **Drag-and-drop** to reparent nodes (with cycle prevention) or free-move in `free` layout
- **Themes** — light, dark, sepia, high-contrast, aqua, prague
- **Branch colors** — pastel outlines per branch, fully customizable per node
- **Priorities & status** — mark any node 1–4 (corner badge) or complete (✓ badge with strike-through)
- **Right-click context menu** — rename, add child/sibling, set priority, mark complete, color, duplicate, delete
- **Auto-align** — recompute the active layout at any time
- **Keyboard-first**
  - `Tab` — add child
  - `Enter` — add sibling
  - `F2` — rename selected
  - `Del` / `Backspace` — delete subtree
  - `Space` — collapse / expand
  - `Arrows` — move selection in 2D
  - `1`–`4` — set priority, `0` — clear; `Ctrl+Enter` — toggle complete
  - `Ctrl+Z` / `Ctrl+Y` — undo / redo
  - `Ctrl+S` / `Ctrl+Shift+S` — save / save as
  - `Ctrl+O` — open
  - `A` — auto-align, `F` — fit to screen
  - Mouse wheel — zoom; click-drag empty area — pan
- **Persistence**
  - `Save` / `Save As` use the File System Access API where available, with download fallback
  - Filename auto-derived from the central node's text
  - Autosave to `localStorage` after every change

## File format — `.hmap.json`

```json
{
  "format": "hive-mindmap",
  "version": 1,
  "meta": { "title": "...", "createdAt": "...", "updatedAt": "...", "theme": "light" },
  "layout": "radial",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "root": {
    "id": "root",
    "text": "Welcome",
    "color": "#9ad0e8",
    "priority": 2,
    "completed": false,
    "children": [ { "id": "...", "text": "...", "children": [] } ]
  }
}
```

A sample lives at [samples/welcome.hmap.json](samples/welcome.hmap.json).

## Project layout

```
index.html
src/
  app.js              # entry point, wiring, input handling
  core/
    model.js          # tree CRUD, ids, validation
    history.js        # undo/redo snapshots
  io/
    io.js             # File System Access API + autosave
  view/
    render.js         # SVG connectors + DOM nodes
    layout.js         # radial / tree-h / tree-v / free
  styles/
    app.css
    themes.css
samples/
  welcome.hmap.json
```

## Deploy

No backend, no build — host the repo root on any static host:

- **Azure Static Web Apps** — App location `/`, leave Api/Output empty
- **GitHub Pages** — already wired via [.github/workflows/pages.yml](.github/workflows/pages.yml)
- **Azure Storage static website**, Netlify, Vercel, etc.

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for project conventions.
