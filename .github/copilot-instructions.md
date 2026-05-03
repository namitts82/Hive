# Hive Mind Mapping Tool — Copilot Instructions

## Project overview
Hive is a browser-based mind mapping tool inspired by MindMup. It runs entirely in the browser with no backend, and persists mind maps to a versioned JSON file format (`.hmap.json`).

## Goals
- Visual interface to create, edit, and manage mind maps in the browser.
- Codified file format: JSON-based (`.hmap.json`) for portability and diff-friendliness.
- Drag-and-drop node manipulation.
- Multiple themes (light, dark, sepia, high-contrast, etc.).
- Auto-alignment / auto-layout (radial, horizontal tree, vertical tree).
- Save / load via File System Access API with download fallback.

## Tech stack
- **Pure front-end:** HTML5 + CSS3 + vanilla JavaScript (ES modules). No framework dependency unless justified.
- **Rendering:** SVG for connectors, absolutely positioned DOM nodes for content (so text editing is native).
- **Storage:** Local file (download/upload) and `localStorage` for autosave.
- **Build:** None required for MVP — open `index.html` directly. Optional Vite later.

## File format (`.hmap.json`)
```json
{
  "format": "hive-mindmap",
  "version": 1,
  "meta": { "title": "string", "createdAt": "iso8601", "updatedAt": "iso8601", "theme": "string" },
  "root": {
    "id": "uuid",
    "text": "string",
    "notes": "string?",
    "color": "string?",
    "collapsed": false,
    "children": [ /* recursive */ ]
  },
  "layout": "radial | tree-h | tree-v | free",
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

## Coding conventions
- ES modules (`type="module"`), `const`/`let` only, no `var`.
- 2-space indentation, single quotes for JS, double quotes for HTML attrs.
- Keep modules small and single-purpose: `model.js`, `render.js`, `layout.js`, `io.js`, `themes.js`, `commands.js`.
- No external network calls. All assets local.
- Accessibility: keyboard navigation (Tab/Arrows/Enter/Delete) and ARIA roles for nodes.

## What to avoid
- No telemetry, no analytics, no remote fonts.
- No introduction of heavy frameworks (React/Vue/etc.) without an issue discussing trade-offs.
- No breaking changes to the file format without bumping `version` and providing a migrator.
