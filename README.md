# Hive 🐝 — Mind Mapping Tool

A browser-based mind mapping tool inspired by [MindMup](https://www.mindmup.com/). Pure HTML + CSS + vanilla JavaScript — no build step, no backend, no telemetry. Maps are saved as portable, diff-friendly `.hmap.json` files.

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
- **Auto-align** — recompute the active layout at any time
- **Keyboard-first**
  - `Tab` — add child
  - `Enter` — add sibling
  - `F2` — rename selected
  - `Del` / `Backspace` — delete subtree
  - `Space` — collapse / expand
  - `Arrows` — move selection in 2D
  - `Ctrl+Z` / `Ctrl+Y` — undo / redo
  - `Ctrl+S` / `Ctrl+Shift+S` — save / save as
  - `Ctrl+O` — open
  - `A` — auto-align, `F` — fit to screen
  - Mouse wheel — zoom; click-drag empty area — pan
- **Persistence**
  - `Save` / `Save As` use the File System Access API where available, with download fallback
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
    "children": [ { "id": "...", "text": "...", "children": [] } ]
  }
}
```

A sample lives at [samples/welcome.hmap.json](samples/welcome.hmap.json).

## Project layout

```
index.html
src/
  app.js          # entry point, input handling
  model.js        # tree CRUD + load/serialize
  layout.js       # radial / tree-h / tree-v / free
  render.js       # SVG connectors + DOM nodes
  io.js           # File System Access API + autosave
  history.js      # undo/redo snapshots
  styles/
    app.css
    themes.css
samples/
  welcome.hmap.json
```

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for project conventions.
