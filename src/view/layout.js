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

/* ---------------- Radial layout (MindMup-style) ---------------- */
function radial(root) {
  const positions = new Map();
  positions.set(root.id, { x: 0, y: 0 });

  const kids = root.children;
  if (kids.length === 0) return positions;

  // Leaf count drives angular weight so dense subtrees get more arc.
  const leafCount = (n) => (n.collapsed || !n.children.length)
    ? 1
    : n.children.reduce((s, c) => s + leafCount(c), 0);

  // Split top-level branches into two sides for balance.
  // Distribute by alternating into the lighter side for even weight.
  const right = [], left = [];
  let rW = 0, lW = 0;
  for (const k of kids) {
    const w = leafCount(k);
    if (rW <= lW) { right.push(k); rW += w; } else { left.push(k); lW += w; }
  }

  // Per-depth ring radius. Wider gap on first ring to clear root, then steady.
  const RADIUS = (depth) => 220 + (depth - 1) * 200;

  // Minimum angular separation needed between two leaves at a given radius
  // so their bounding boxes don't collide.
  const minArcAt = (radius) => {
    const chord = NODE_W + GAP_X * 0.5; // horizontal footprint + breathing room
    return 2 * Math.asin(Math.min(1, chord / (2 * Math.max(radius, 1))));
  };

  layoutSide(right, 0, +1);
  layoutSide(left, Math.PI, -1);

  function layoutSide(branches, baseAngle, dir) {
    if (!branches.length) return;
    const totalLeaves = branches.reduce((s, b) => s + leafCount(b), 0) || 1;
    // Use up to ~170° per side; expand if many leaves demand it.
    const r1 = RADIUS(1);
    const needed = totalLeaves * minArcAt(r1) * 1.1;
    const span = Math.min(Math.PI * 1.0, Math.max(Math.PI * 0.6, needed));
    const start = baseAngle - span / 2;

    let acc = 0;
    for (const branch of branches) {
      const w = leafCount(branch);
      const wedge = (w / totalLeaves) * span;
      const a0 = start + acc;
      const a1 = a0 + wedge;
      placeBranch(branch, a0, a1, 1, dir);
      acc += wedge;
    }
  }

  // Place a node at the centre of its [a0, a1] wedge on the ring at `depth`,
  // then recurse children into proportional sub-wedges on the next ring.
  function placeBranch(node, a0, a1, depth, dir) {
    const angle = (a0 + a1) / 2;
    const radius = RADIUS(depth);
    positions.set(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });

    if (node.collapsed || node.children.length === 0) return;

    const children = node.children;
    const totalLeaves = children.reduce((s, c) => s + leafCount(c), 0) || 1;

    // Wedge for this node, but make sure children get at least their min arc
    // at the next ring; widen the wedge symmetrically if necessary.
    const r2 = RADIUS(depth + 1);
    const minNeeded = children.length * minArcAt(r2) * 1.05;
    let wedge = a1 - a0;
    if (wedge < minNeeded) {
      const grow = (minNeeded - wedge) / 2;
      a0 -= grow; a1 += grow; wedge = a1 - a0;
    }

    let acc = 0;
    for (const c of children) {
      const w = leafCount(c);
      const sub = (w / totalLeaves) * wedge;
      const c0 = a0 + acc;
      const c1 = c0 + sub;
      placeBranch(c, c0, c1, depth + 1, dir);
      acc += sub;
    }
  }

  return positions;
}

export const NODE_SIZE = { w: NODE_W, h: NODE_H };
