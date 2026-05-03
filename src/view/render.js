// Render the model into the DOM + SVG. Stateless except for caching node elements.
import { walk } from '../core/model.js';
import { computeLayout } from './layout.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Pick black or white text for a given background color (hex / short hex / rgb()).
function pickReadableFg(color) {
  let r = 0, g = 0, b = 0;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    const rgb = /rgba?\(([^)]+)\)/.exec(color);
    if (rgb) {
      const parts = rgb[1].split(',').map((p) => parseFloat(p));
      [r, g, b] = parts;
    } else {
      return '';
    }
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1d2330' : '#ffffff';
}

export class Renderer {
  constructor(rootEl, svgEl, wrapEl) {
    this.rootEl = rootEl;     // .nodes
    this.svgEl = svgEl;       // .connectors
    this.wrapEl = wrapEl;     // .canvas-wrap
    this.viewport = { x: 0, y: 0, zoom: 1 };
    this.positions = new Map();
    this.nodeEls = new Map();
  }

  setViewport(v) {
    this.viewport = { ...this.viewport, ...v };
    this.applyTransform();
  }

  panBy(dx, dy) {
    this.viewport.x += dx;
    this.viewport.y += dy;
    this.applyTransform();
  }

  zoomAt(clientX, clientY, factor) {
    const rect = this.wrapEl.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const z0 = this.viewport.zoom;
    const z1 = Math.min(3, Math.max(0.2, z0 * factor));
    // Keep cursor anchored.
    this.viewport.x = cx - ((cx - this.viewport.x) * z1 / z0);
    this.viewport.y = cy - ((cy - this.viewport.y) * z1 / z0);
    this.viewport.zoom = z1;
    this.applyTransform();
  }

  applyTransform() {
    const { x, y, zoom } = this.viewport;
    const t = `translate(${x}px, ${y}px) scale(${zoom})`;
    this.rootEl.style.transform = t;
    this.svgEl.style.transform = t;
    this.svgEl.style.transformOrigin = '0 0';
  }

  /** World coordinate (origin at the centre of the wrap by default). */
  worldOrigin() {
    const r = this.wrapEl.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2 };
  }

  fit(doc) {
    if (this.positions.size === 0) return;
    const r = this.wrapEl.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.positions.values()) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 120;
    const w = (maxX - minX) + pad * 2;
    const h = (maxY - minY) + pad * 2;
    const zoom = Math.min(1, Math.min(r.width / w, r.height / h));
    const origin = this.worldOrigin();
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.viewport.zoom = zoom;
    // Node screen X = viewport.x + (origin.x + pos.x) * zoom.
    // We want bbox center to land at the wrap centre (origin.x, origin.y).
    this.viewport.x = origin.x - (origin.x + cx) * zoom;
    this.viewport.y = origin.y - (origin.y + cy) * zoom;
    this.applyTransform();
    doc.viewport = { ...this.viewport };
  }

  render(doc, selectedId) {
    this.positions = computeLayout(doc);

    // Reuse existing DOM nodes; remove stale.
    const seen = new Set();
    const pastelIndex = new Map(); // id -> sibling index among depth-1 nodes
    doc.root.children.forEach((c, i) => pastelIndex.set(c.id, i % 6));
    walk(doc.root, (n, parent, depth) => {
      if (parent && (parent.collapsed)) return; // skip drawing under collapsed
      seen.add(n.id);
      let el = this.nodeEls.get(n.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'node';
        el.setAttribute('role', 'treeitem');
        el.setAttribute('tabindex', '-1');
        const label = document.createElement('span');
        label.className = 'label';
        el.appendChild(label);
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.setAttribute('aria-hidden', 'true');
        el.appendChild(badge);
        this.rootEl.appendChild(el);
        this.nodeEls.set(n.id, el);
      }
      const label = el.querySelector('.label');
      const badge = el.querySelector('.badge');
      el.dataset.id = n.id;
      el.dataset.childrenCount = n.children.length;
      el.dataset.depth = depth;
      if (depth === 1 && pastelIndex.has(n.id)) {
        el.dataset.pastel = pastelIndex.get(n.id);
      } else {
        delete el.dataset.pastel;
      }
      el.classList.toggle('root', n === doc.root);
      el.classList.toggle('selected', n.id === selectedId);
      el.classList.toggle('collapsed', !!n.collapsed && n.children.length > 0);
      el.classList.toggle('completed', !!n.completed);
      if (!label.classList.contains('editing')) label.textContent = n.text;

      // Priority / completion badge in the top-right corner.
      if (n.completed) {
        badge.hidden = false;
        badge.className = 'badge badge-done';
        badge.textContent = '✓';
        badge.title = 'Completed';
      } else if (n.priority >= 1 && n.priority <= 4) {
        badge.hidden = false;
        badge.className = 'badge badge-p p' + n.priority;
        badge.textContent = 'P' + n.priority;
        badge.title = 'Priority ' + n.priority;
      } else {
        badge.hidden = true;
        badge.className = 'badge';
        badge.textContent = '';
      }
      if (n.color) {
        el.dataset.colored = '1';
        el.style.background = '';
        el.style.borderColor = n.color;
        el.style.color = '';
      } else {
        delete el.dataset.colored;
        el.style.background = '';
        el.style.borderColor = '';
        el.style.color = '';
      }
      const pos = this.positions.get(n.id);
      const origin = this.worldOrigin();
      if (pos) {
        el.style.left = (origin.x + pos.x) + 'px';
        el.style.top = (origin.y + pos.y) + 'px';
      }
    });
    for (const [id, el] of this.nodeEls) {
      if (!seen.has(id)) { el.remove(); this.nodeEls.delete(id); }
    }

    this.renderEdges(doc);
  }

  renderEdges(doc) {
    // Match SVG size to wrap so coords align with absolute children.
    // overflow:visible so paths to nodes outside the viewport still render
    // (the wrap area is small but the layout/world can be much larger).
    const r = this.wrapEl.getBoundingClientRect();
    this.svgEl.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    this.svgEl.setAttribute('width', r.width);
    this.svgEl.setAttribute('height', r.height);
    this.svgEl.style.overflow = 'visible';

    while (this.svgEl.firstChild) this.svgEl.removeChild(this.svgEl.firstChild);
    const origin = this.worldOrigin();

    walk(doc.root, (n) => {
      if (n.collapsed) return;
      const p = this.positions.get(n.id);
      if (!p) return;
      for (const c of n.children) {
        const cp = this.positions.get(c.id);
        if (!cp) continue;
        const x1 = origin.x + p.x;
        const y1 = origin.y + p.y;
        const x2 = origin.x + cp.x;
        const y2 = origin.y + cp.y;
        const path = document.createElementNS(SVG_NS, 'path');
        const dx = (x2 - x1) * 0.5;
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
        this.svgEl.appendChild(path);
      }
    });
  }

  getNodeEl(id) { return this.nodeEls.get(id); }
}
