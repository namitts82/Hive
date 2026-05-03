// Auto-layout algorithms. Each returns a Map<id, {x, y}>.
// All positions are in the world (untransformed) coordinate system.
import { walk } from '../core/model.js';

const NODE_H = 44;
const GAP_X = 48;
const GAP_Y = 18;
const MIN_W = 80;
const MAX_W = 480;
const CHAR_W = 7.6;   // approx px per char at 14px sans-serif
const PAD_X  = 28;    // 12px padding * 2 + a little badge slack

// Estimate the rendered width of a node from its text length so layouts can
// grow horizontally with longer labels (CSS uses width:max-content).
function nodeWidth(n) {
  const text = (n && n.text) ? String(n.text) : '';
  const w = Math.ceil(text.length * CHAR_W) + PAD_X;
  return Math.max(MIN_W, Math.min(MAX_W, w));
}

export function computeLayout(doc) {
  switch (doc.layout) {
    case 'tree-h': return treeHorizontal(doc.root);
    case 'tree-v': return treeVertical(doc.root);
    case 'free':   return freePositions(doc.root);
    case 'radial':
    default:       return radial(doc.root);
  }
}

/** Free layout: keep stored x/y or fall back to radial. */
function freePositions(root) {
  const positions = new Map();
  const fallback = radial(root);
  walk(root, (n) => {
    if (typeof n.x === 'number' && typeof n.y === 'number') {
      positions.set(n.id, { x: n.x, y: n.y });
    } else {
      positions.set(n.id, fallback.get(n.id));
    }
  });
  return positions;
}

/* ---------------- Horizontal tree (root on left, children to right) ---------------- */
function treeHorizontal(root) {
  const positions = new Map();
  // Per-depth column position based on the widest node in earlier columns.
  const colMaxW = depthMaxWidths(root);
  const colX = [0];
  for (let i = 1; i < colMaxW.length; i++) colX.push(colX[i - 1] + colMaxW[i - 1] + GAP_X);
  let cursorY = 0;

  function place(node, depth) {
    if (node.collapsed || node.children.length === 0) {
      const y = cursorY;
      cursorY += NODE_H + GAP_Y;
      positions.set(node.id, { x: colX[depth] || 0, y });
      return y;
    }
    const childYs = node.children.map((c) => place(c, depth + 1));
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    positions.set(node.id, { x: colX[depth] || 0, y });
    return y;
  }

  place(root, 0);
  return positions;
}

/* ---------------- Vertical tree (root on top, children below) ---------------- */
function treeVertical(root) {
  const positions = new Map();
  let cursorX = 0;

  function place(node, depth) {
    const w = nodeWidth(node);
    if (node.collapsed || node.children.length === 0) {
      const x = cursorX + w / 2;
      cursorX += w + GAP_X / 2;
      positions.set(node.id, { x, y: depth * (NODE_H + GAP_Y * 3) });
      return x;
    }
    const childXs = node.children.map((c) => place(c, depth + 1));
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    positions.set(node.id, { x, y: depth * (NODE_H + GAP_Y * 3) });
    return x;
  }

  place(root, 0);
  return positions;
}

/* Largest width at each tree depth (depth 0 = root). */
function depthMaxWidths(root) {
  const max = [];
  walk(root, (n, _p, d) => {
    const w = nodeWidth(n);
    if (max[d] === undefined || w > max[d]) max[d] = w;
  });
  return max;
}

/* ---------------- Centered bidirectional tree (default 'radial' option) ----------------
   Root in the middle. Top-level branches balanced left/right by leaf weight.
   Each side is a tidy horizontal tree extending outward with short edges. */
function radial(root) {
  const positions = new Map();
  positions.set(root.id, { x: 0, y: 0 });

  const kids = root.children;
  if (kids.length === 0) return positions;

  const leafCount = (n) => (n.collapsed || !n.children.length)
    ? 1
    : n.children.reduce((s, c) => s + leafCount(c), 0);

  // Balance branches into left/right by leaf weight (lightest side wins).
  const right = [], left = [];
  let rW = 0, lW = 0;
  for (const k of kids) {
    const w = leafCount(k);
    if (rW <= lW) { right.push(k); rW += w; } else { left.push(k); lW += w; }
  }

  const STEP_Y = NODE_H + GAP_Y;
  const ROOT_W = nodeWidth(root);

  function layoutSide(branches, dir) {
    if (!branches.length) return;

    // Per-depth column widths for THIS side only (depth 1 is the first ring).
    const colMaxW = [0]; // depth 0 unused (root handled separately)
    function scan(n, d) {
      const w = nodeWidth(n);
      if (colMaxW[d] === undefined || w > colMaxW[d]) colMaxW[d] = w;
      if (!n.collapsed) for (const c of n.children) scan(c, d + 1);
    }
    for (const b of branches) scan(b, 1);

    // X centre of the column at depth d (offset from root, measured outward).
    // First column starts after half the root + gap + half its own width.
    const colCenter = [0, ROOT_W / 2 + GAP_X + colMaxW[1] / 2];
    for (let d = 2; d < colMaxW.length; d++) {
      colCenter[d] = colCenter[d - 1] + colMaxW[d - 1] / 2 + GAP_X + colMaxW[d] / 2;
    }

    const ids = [];
    let cursorY = 0;

    function place(node, depth) {
      ids.push(node.id);
      const x = dir * colCenter[depth];
      if (node.collapsed || node.children.length === 0) {
        const y = cursorY;
        cursorY += STEP_Y;
        positions.set(node.id, { x, y });
        return y;
      }
      const ys = node.children.map((c) => place(c, depth + 1));
      const y = (ys[0] + ys[ys.length - 1]) / 2;
      positions.set(node.id, { x, y });
      return y;
    }

    const branchYs = branches.map((b) => place(b, 1));
    const center = (branchYs[0] + branchYs[branchYs.length - 1]) / 2;
    for (const id of ids) {
      const p = positions.get(id);
      positions.set(id, { x: p.x, y: p.y - center });
    }
  }

  layoutSide(right, +1);
  layoutSide(left, -1);

  return positions;
}

export const NODE_SIZE = { h: NODE_H, minW: MIN_W, maxW: MAX_W };
