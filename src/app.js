// Hive — entry point. Wires model, renderer, IO, history, and input.
import * as M from './core/model.js';
import { Renderer } from './view/render.js';
import { IOService } from './io/io.js';
import { History } from './core/history.js';

const els = {
  wrap: document.getElementById('canvas-wrap'),
  nodes: document.getElementById('nodes'),
  svg: document.getElementById('connectors'),
  status: document.getElementById('status'),
  autosave: document.getElementById('autosave-indicator'),
  layoutSelect: document.getElementById('layout-select'),
  themeSelect: document.getElementById('theme-select'),
  contextMenu: document.getElementById('context-menu'),
};

const io = new IOService();
const history = new History();
const renderer = new Renderer(els.nodes, els.svg, els.wrap);

let doc = io.loadAutosave() || M.newDocument('Central idea');
let selectedId = doc.root.id;
const isFreshMap = !io.loadAutosave();

history.reset(doc);
applyTheme(doc.meta.theme);
els.layoutSelect.value = doc.layout;
els.themeSelect.value = doc.meta.theme;

requestAnimationFrame(() => {
  renderer.setViewport(doc.viewport);
  rerender();
  renderer.fit(doc);
  rerender();
  if (isFreshMap) editNode(doc.root.id);
});

window.addEventListener('resize', rerender);

/* ---------------- Render helpers ---------------- */
function rerender() {
  renderer.render(doc, selectedId);
  attachNodeHandlers();
  setStatus(`${countNodes(doc.root)} nodes • ${doc.layout}`);
}

function countNodes(n) {
  let c = 0; M.walk(n, () => c++); return c;
}

function setStatus(msg) { els.status.textContent = msg; }
function flashAutosave() {
  els.autosave.textContent = 'Autosaved';
  clearTimeout(flashAutosave._t);
  flashAutosave._t = setTimeout(() => { els.autosave.textContent = ''; }, 1200);
}

let autosaveTimer = null;
function commit() {
  history.push(doc);
  rerender();
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { io.autosave(doc); flashAutosave(); }, 400);
}

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  doc.meta.theme = name;
}

/* ---------------- Toolbar ---------------- */
document.querySelector('.toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cmd]');
  if (!btn) return;
  runCommand(btn.dataset.cmd);
});

els.layoutSelect.addEventListener('change', (e) => {
  doc.layout = e.target.value;
  commit();
});
els.themeSelect.addEventListener('change', (e) => {
  applyTheme(e.target.value);
  commit();
});

async function runCommand(cmd) {
  switch (cmd) {
    case 'new': {
      if (!confirm('Discard current map and start a new one?')) return;
      const title = (prompt('Name your central idea:', 'Central idea') || '').trim() || 'Central idea';
      doc = M.newDocument(title);
      selectedId = doc.root.id;
      io.fileHandle = null;
      history.reset(doc);
      els.themeSelect.value = doc.meta.theme;
      els.layoutSelect.value = doc.layout;
      applyTheme(doc.meta.theme);
      renderer.setViewport(doc.viewport);
      rerender();
      renderer.fit(doc);
      rerender();
      io.autosave(doc);
      break;
    }
    case 'open': {
      try {
        const { doc: loaded, name } = await io.openWithPicker();
        doc = loaded;
        selectedId = doc.root.id;
        history.reset(doc);
        els.layoutSelect.value = doc.layout;
        els.themeSelect.value = doc.meta.theme || 'light';
        applyTheme(doc.meta.theme || 'light');
        renderer.setViewport(doc.viewport);
        rerender();
        renderer.fit(doc);
        rerender();
        setStatus(`Opened ${name}`);
      } catch (err) {
        if (err?.name !== 'AbortError') alert('Failed to open: ' + err.message);
      }
      break;
    }
    case 'sample': {
      try {
        const res = await fetch('samples/welcome.hmap.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        doc = M.loadDocument(await res.json());
        selectedId = doc.root.id;
        io.fileHandle = null;
        history.reset(doc);
        els.layoutSelect.value = doc.layout;
        els.themeSelect.value = doc.meta.theme || 'light';
        applyTheme(doc.meta.theme || 'light');
        renderer.setViewport(doc.viewport);
        rerender();
        renderer.fit(doc);
        rerender();
        io.autosave(doc);
        setStatus('Loaded welcome sample');
      } catch (err) {
        alert('Could not load sample (try serving the folder over http):\n' + err.message);
      }
      break;
    }
    case 'save': {
      try {
        const name = await io.save(doc);
        setStatus(`Saved ${name}`);
      } catch (err) {
        if (err?.name !== 'AbortError') alert('Save failed: ' + err.message);
      }
      break;
    }
    case 'save-as': {
      try {
        const name = await io.saveAs(doc);
        setStatus(`Saved ${name}`);
      } catch (err) {
        if (err?.name !== 'AbortError') alert('Save failed: ' + err.message);
      }
      break;
    }
    case 'add-child': {
      const child = M.addChild(doc.root, selectedId);
      if (child) { selectedId = child.id; commit(); editNode(child.id, true); }
      break;
    }
    case 'add-sibling': {
      const sib = M.addSibling(doc.root, selectedId);
      if (sib) { selectedId = sib.id; commit(); editNode(sib.id, true); }
      break;
    }
    case 'delete': {
      if (selectedId === doc.root.id) return;
      const parent = M.findParent(doc.root, selectedId);
      M.deleteNode(doc.root, selectedId);
      selectedId = parent ? parent.id : doc.root.id;
      commit();
      break;
    }
    case 'undo': {
      const prev = history.undo();
      if (prev) { doc = prev; ensureSelection(); rerender(); }
      break;
    }
    case 'redo': {
      const next = history.redo();
      if (next) { doc = next; ensureSelection(); rerender(); }
      break;
    }
    case 'auto-align': {
      M.walk(doc.root, (n) => { delete n.x; delete n.y; });
      commit();
      renderer.fit(doc);
      rerender();
      break;
    }
    case 'zoom-in':    renderer.zoomAt(els.wrap.clientWidth / 2, els.wrap.clientHeight / 2, 1.2); break;
    case 'zoom-out':   renderer.zoomAt(els.wrap.clientWidth / 2, els.wrap.clientHeight / 2, 1 / 1.2); break;
    case 'zoom-reset': renderer.setViewport({ zoom: 1 }); rerender(); break;
    case 'fit':        renderer.fit(doc); rerender(); break;
  }
}

function ensureSelection() {
  if (!M.findNode(doc.root, selectedId)) selectedId = doc.root.id;
}

/* ---------------- Node interaction ---------------- */
function attachNodeHandlers() {
  for (const [id, el] of renderer.nodeEls) {
    if (el._wired) continue;
    el._wired = true;

    el.addEventListener('mousedown', onNodeMouseDown);
    el.addEventListener('dblclick', () => editNode(id));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedId = id;
      rerender();
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedId = id;
      rerender();
      openContextMenu(e.clientX, e.clientY, id);
    });
  }
}

function editNode(id, selectAll = false) {
  const el = renderer.getNodeEl(id);
  if (!el) return;
  const label = el.querySelector('.label') || el;
  label.classList.add('editing');
  label.setAttribute('contenteditable', 'true');
  label.focus();
  // Select all text for new nodes (so the next keystroke overwrites the placeholder),
  // otherwise place the caret at the end for normal in-place edits.
  const range = document.createRange();
  range.selectNodeContents(label);
  if (!selectAll) range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);

  const finish = (commitChange) => {
    label.removeEventListener('blur', onBlur);
    label.removeEventListener('keydown', onKey);
    label.classList.remove('editing');
    label.removeAttribute('contenteditable');
    if (commitChange) {
      const text = label.textContent.trim() || 'Untitled';
      M.setText(doc.root, id, text);
      commit();
    } else {
      const node = M.findNode(doc.root, id);
      if (node) label.textContent = node.text;
    }
  };
  const onBlur = () => finish(true);
  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); label.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  };
  label.addEventListener('blur', onBlur);
  label.addEventListener('keydown', onKey);
}

/* ---------------- Drag: reparent or free-move ---------------- */
let drag = null;

function onNodeMouseDown(e) {
  if (e.button !== 0) return;
  if (e.target.closest('.label')?.classList.contains('editing')) return;
  const el = e.currentTarget;
  const id = el.dataset.id;
  if (id === doc.root.id && doc.layout !== 'free') {
    // Allow root to be dragged in free mode only.
  }
  selectedId = id;
  drag = {
    id, el,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    dropTarget: null,
  };
  el.classList.add('dragging');
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragUp, { once: true });
  rerender();
  e.preventDefault();
}

function onDragMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;

  if (doc.layout === 'free') {
    const node = M.findNode(doc.root, drag.id);
    const z = renderer.viewport.zoom;
    const origin = renderer.worldOrigin();
    const wx = (e.clientX - els.wrap.getBoundingClientRect().left - renderer.viewport.x) / z - origin.x;
    const wy = (e.clientY - els.wrap.getBoundingClientRect().top - renderer.viewport.y) / z - origin.y;
    node.x = wx; node.y = wy;
    renderer.render(doc, selectedId);
    return;
  }

  // Highlight potential drop target.
  const target = pickNodeAt(e.clientX, e.clientY, drag.id);
  if (drag.dropTarget && drag.dropTarget !== target) {
    drag.dropTarget.classList.remove('drop-target');
  }
  if (target) target.classList.add('drop-target');
  drag.dropTarget = target;
}

function onDragUp(e) {
  document.removeEventListener('mousemove', onDragMove);
  if (!drag) return;
  const { id, el, moved, dropTarget } = drag;
  el.classList.remove('dragging');
  if (dropTarget) dropTarget.classList.remove('drop-target');
  drag = null;

  if (!moved) { rerender(); return; }

  if (doc.layout === 'free') { commit(); return; }

  if (dropTarget) {
    const newParent = dropTarget.dataset.id;
    if (M.reparent(doc.root, id, newParent)) {
      commit();
      return;
    }
  }
  rerender();
}

function pickNodeAt(clientX, clientY, excludeId) {
  for (const [id, el] of renderer.nodeEls) {
    if (id === excludeId) continue;
    if (M.isAncestor(doc.root, excludeId, id)) continue;
    const r = el.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return el;
    }
  }
  return null;
}

/* ---------------- Canvas pan + zoom ---------------- */
let panning = null;
els.wrap.addEventListener('mousedown', (e) => {
  if (e.target.closest('.node')) return;
  panning = { x: e.clientX, y: e.clientY };
  els.wrap.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!panning) return;
  renderer.panBy(e.clientX - panning.x, e.clientY - panning.y);
  panning.x = e.clientX; panning.y = e.clientY;
});
window.addEventListener('mouseup', () => {
  panning = null;
  els.wrap.style.cursor = '';
});
els.wrap.addEventListener('click', (e) => {
  if (e.target.closest('.node')) return;
  selectedId = doc.root.id;
  rerender();
});

els.wrap.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.node')) return; // node menu is handled per-node
  e.preventDefault();
  closeContextMenu();
});

els.wrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 30) {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    renderer.zoomAt(e.clientX, e.clientY, factor);
    rerender();
  } else {
    renderer.panBy(-e.deltaX, -e.deltaY);
  }
}, { passive: false });

/* ---------------- Keyboard ---------------- */
window.addEventListener('keydown', (e) => {
  const editing = document.activeElement?.classList.contains('editing');
  if (editing) return;

  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); runCommand(e.shiftKey ? 'redo' : 'undo'); return; }
  if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); runCommand('redo'); return; }
  if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); runCommand(e.shiftKey ? 'save-as' : 'save'); return; }
  if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); runCommand('open'); return; }
  if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); runCommand('new'); return; }
  if (ctrl && e.key === 'Enter') {
    e.preventDefault();
    M.setCompleted(doc.root, selectedId);
    commit();
    return;
  }

  switch (e.key) {
    case 'Tab':    e.preventDefault(); runCommand('add-child'); break;
    case 'Enter':  e.preventDefault(); runCommand('add-sibling'); break;
    case 'Delete':
    case 'Backspace': e.preventDefault(); runCommand('delete'); break;
    case 'F2':     e.preventDefault(); editNode(selectedId); break;
    case ' ':      e.preventDefault(); M.toggleCollapsed(doc.root, selectedId); commit(); break;
    case 'a':
    case 'A':      runCommand('auto-align'); break;
    case 'f':
    case 'F':      runCommand('fit'); break;
    case '1': case '2': case '3': case '4':
      e.preventDefault();
      M.setPriority(doc.root, selectedId, parseInt(e.key, 10));
      commit();
      break;
    case '0':
      e.preventDefault();
      M.setPriority(doc.root, selectedId, null);
      commit();
      break;
    case 'ArrowUp':    e.preventDefault(); moveSelection('up'); break;
    case 'ArrowDown':  e.preventDefault(); moveSelection('down'); break;
    case 'ArrowLeft':  e.preventDefault(); moveSelection('left'); break;
    case 'ArrowRight': e.preventDefault(); moveSelection('right'); break;
  }
});

function moveSelection(dir) {
  // Pick nearest visible node in the requested direction.
  const cur = renderer.positions.get(selectedId);
  if (!cur) return;
  let best = null;
  let bestScore = Infinity;
  for (const [id, p] of renderer.positions) {
    if (id === selectedId) continue;
    const dx = p.x - cur.x;
    const dy = p.y - cur.y;
    let primary, secondary;
    switch (dir) {
      case 'up':    primary = -dy; secondary = Math.abs(dx); break;
      case 'down':  primary =  dy; secondary = Math.abs(dx); break;
      case 'left':  primary = -dx; secondary = Math.abs(dy); break;
      case 'right': primary =  dx; secondary = Math.abs(dy); break;
    }
    if (primary <= 0) continue;
    const score = secondary * 2 + primary * 0.5;
    if (score < bestScore) { bestScore = score; best = id; }
  }
  if (best) { selectedId = best; rerender(); }
}

/* ---------------- Context menu ---------------- */
const NODE_COLORS = [
  '#f7a8a0', // pastel coral
  '#f6c177', // pastel apricot
  '#f4d35e', // pastel butter
  '#a8d8a3', // pastel sage
  '#9ad0e8', // pastel sky
  '#b8a5e3', // pastel lavender
  '#f1b6d4', // pastel blush
  '#c9b899', // pastel sand
];

function openContextMenu(x, y, nodeId) {
  const node = M.findNode(doc.root, nodeId);
  if (!node) return;
  const isRoot = nodeId === doc.root.id;
  const hasChildren = node.children.length > 0;

  const items = [
    { label: 'Add child',      shortcut: 'Tab',   cmd: 'add-child' },
    { label: 'Add sibling',    shortcut: 'Enter', cmd: 'add-sibling', disabled: isRoot },
    { label: 'Rename',         shortcut: 'F2',    cmd: 'rename' },
    { sep: true },
    { label: node.completed ? 'Mark as incomplete' : 'Mark as complete',
      shortcut: 'Ctrl+Enter', cmd: 'toggle-complete' },
    { priorities: true },
    { sep: true },
    { label: node.collapsed ? 'Expand' : 'Collapse', shortcut: 'Space', cmd: 'collapse', disabled: !hasChildren },
    { label: 'Delete',         shortcut: 'Del',   cmd: 'delete', disabled: isRoot },
    { sep: true },
    { label: 'Duplicate subtree', cmd: 'duplicate', disabled: isRoot },
    { swatches: true },
  ];

  const menu = els.contextMenu;
  menu.innerHTML = '';
  for (const it of items) {
    if (it.sep) {
      const s = document.createElement('div');
      s.className = 'sep';
      menu.appendChild(s);
      continue;
    }
    if (it.swatches) {
      const row = document.createElement('div');
      row.className = 'swatches';
      const clear = document.createElement('div');
      clear.className = 'swatch clear';
      clear.title = 'Clear color';
      clear.addEventListener('click', () => { delete node.color; commit(); closeContextMenu(); });
      row.appendChild(clear);
      for (const c of NODE_COLORS) {
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.background = c;
        sw.title = c;
        sw.addEventListener('click', () => { node.color = c; commit(); closeContextMenu(); });
        row.appendChild(sw);
      }
      menu.appendChild(row);
      continue;
    }
    if (it.priorities) {
      const row = document.createElement('div');
      row.className = 'priorities';
      const label = document.createElement('span');
      label.className = 'priorities-label';
      label.textContent = 'Priority';
      row.appendChild(label);
      const clear = document.createElement('button');
      clear.className = 'pri-chip pri-clear' + (!node.priority ? ' active' : '');
      clear.textContent = '—';
      clear.title = 'Clear priority (0)';
      clear.addEventListener('click', () => {
        M.setPriority(doc.root, nodeId, null);
        commit();
        closeContextMenu();
      });
      row.appendChild(clear);
      for (let p = 1; p <= 4; p++) {
        const chip = document.createElement('button');
        chip.className = 'pri-chip p' + p + (node.priority === p ? ' active' : '');
        chip.textContent = 'P' + p;
        chip.title = 'Priority ' + p + ' (' + p + ')';
        chip.addEventListener('click', () => {
          M.setPriority(doc.root, nodeId, p);
          commit();
          closeContextMenu();
        });
        row.appendChild(chip);
      }
      menu.appendChild(row);
      continue;
    }
    const item = document.createElement('div');
    item.className = 'item' + (it.disabled ? ' disabled' : '');
    item.innerHTML = `<span>${it.label}</span>` +
      (it.shortcut ? `<span class="shortcut">${it.shortcut}</span>` : '');
    if (!it.disabled) {
      item.addEventListener('click', () => {
        closeContextMenu();
        runMenuCommand(it.cmd, nodeId);
      });
    }
    menu.appendChild(item);
  }

  menu.hidden = false;
  // Position, then clamp into viewport.
  menu.style.left = '0px';
  menu.style.top = '0px';
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 6);
  const py = Math.min(y, window.innerHeight - rect.height - 6);
  menu.style.left = px + 'px';
  menu.style.top = py + 'px';
}

function closeContextMenu() {
  els.contextMenu.hidden = true;
}

function runMenuCommand(cmd, nodeId) {
  selectedId = nodeId;
  switch (cmd) {
    case 'rename':    editNode(nodeId); break;
    case 'collapse':  M.toggleCollapsed(doc.root, nodeId); commit(); break;
    case 'toggle-complete': M.setCompleted(doc.root, nodeId); commit(); break;
    case 'duplicate': {
      const parent = M.findParent(doc.root, nodeId);
      const node = M.findNode(doc.root, nodeId);
      if (!parent || !node) break;
      const copy = JSON.parse(JSON.stringify(node));
      // Re-id everything in the copy.
      M.walk(copy, (n) => { n.id = M.uid(); });
      const idx = parent.children.findIndex((c) => c.id === nodeId);
      parent.children.splice(idx + 1, 0, copy);
      selectedId = copy.id;
      commit();
      break;
    }
    default: runCommand(cmd);
  }
}

window.addEventListener('mousedown', (e) => {
  if (els.contextMenu.hidden) return;
  if (!els.contextMenu.contains(e.target)) closeContextMenu();
}, true);
window.addEventListener('scroll', closeContextMenu, true);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });

