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

  // Split top-level branches into two sides for balance.
  const kids = root.children.filter(() => true);
  if (kids.length === 0) return positions;

  // Estimate each branch "weight" by leaf count for fair angle allocation.
  const weight = (n) => (n.collapsed || !n.children.length)
    ? 1
    : n.children.reduce((s, c) => s + weight(c), 0);

  // Right and left sides alternate by index for first level.
  const right = [];
  const left = [];
  kids.forEach((k, i) => (i % 2 === 0 ? right : left).push(k));

  layoutSide(right, 0, +1);
  layoutSide(left, Math.PI, -1);

  function layoutSide(branches, baseAngle, dir) {
    const total = branches.reduce((s, b) => s + weight(b), 0) || 1;
    const span = Math.PI * 0.9; // 162° fan per side
    let acc = -span / 2;
    for (const branch of branches) {
      const w = weight(branch);
      const center = baseAngle + acc + (w / total) * span / 2;
      acc += (w / total) * span;
      placeBranch(branch, center, 1, dir);
    }
  }

  function placeBranch(node, angle, depth, dir) {
    const radius = depth * 180;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    positions.set(node.id, { x, y });
    if (node.collapsed) return;
    const childCount = node.children.length;
    if (childCount === 0) return;
    const fan = Math.min(Math.PI / 2, 0.35 * childCount);
    const start = angle - fan / 2;
    const step = childCount > 1 ? fan / (childCount - 1) : 0;
    node.children.forEach((c, i) => {
      const a = childCount === 1 ? angle : start + step * i;
      placeBranch(c, a, depth + 1, dir);
    });
  }

  return positions;
}

export const NODE_SIZE = { w: NODE_W, h: NODE_H };
