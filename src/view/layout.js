// Auto-layout algorithms. Each returns a Map<id, {x, y}>.
// All positions are in the world (untransformed) coordinate system.
import { walk } from '../core/model.js';

const NODE_W = 160;
const NODE_H = 44;
const GAP_X = 48;
const GAP_Y = 18;

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
  let cursorY = 0;

  function place(node, depth) {
    if (node.collapsed || node.children.length === 0) {
      const y = cursorY;
      cursorY += NODE_H + GAP_Y;
      positions.set(node.id, { x: depth * (NODE_W + GAP_X), y });
      return y;
    }
    const childYs = node.children.map((c) => place(c, depth + 1));
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    positions.set(node.id, { x: depth * (NODE_W + GAP_X), y });
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
    if (node.collapsed || node.children.length === 0) {
      const x = cursorX;
      cursorX += NODE_W + GAP_X / 2;
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

  const STEP_X = NODE_W + GAP_X;
  const STEP_Y = NODE_H + GAP_Y;

  function layoutSide(branches, dir) {
    if (!branches.length) return;
    const ids = [];
    let cursorY = 0;

    function place(node, depth) {
      ids.push(node.id);
      const x = dir * depth * STEP_X;
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
    // Center this side's branch span around y=0 (root level).
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

export const NODE_SIZE = { w: NODE_W, h: NODE_H };
