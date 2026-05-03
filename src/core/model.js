// Mind-map data model. Pure functions over a tree of nodes.
// A node: { id, text, notes?, color?, collapsed?, x?, y?, children: [] }

export const FORMAT = 'hive-mindmap';
export const VERSION = 1;

export function uid() {
  // Compact, URL-safe id. Crypto when available, fallback otherwise.
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function newNode(text = 'New idea') {
  return { id: uid(), text, children: [] };
}

export function newDocument(title = 'Untitled mind map') {
  const now = new Date().toISOString();
  return {
    format: FORMAT,
    version: VERSION,
    meta: { title, createdAt: now, updatedAt: now, theme: 'light' },
    layout: 'radial',
    viewport: { x: 0, y: 0, zoom: 1 },
    root: { ...newNode(title), id: 'root' },
  };
}

/** Walk every node, optionally with parent reference. */
export function walk(node, fn, parent = null, depth = 0) {
  fn(node, parent, depth);
  for (const child of node.children) walk(child, fn, node, depth + 1);
}

export function findNode(root, id) {
  let found = null;
  walk(root, (n) => { if (n.id === id) found = n; });
  return found;
}

export function findParent(root, id) {
  let parent = null;
  walk(root, (n) => {
    if (n.children.some((c) => c.id === id)) parent = n;
  });
  return parent;
}

/** Returns true if `ancestor` is an ancestor of (or equal to) `node`. */
export function isAncestor(root, ancestorId, nodeId) {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  let result = false;
  walk(ancestor, (n) => { if (n.id === nodeId) result = true; });
  return result;
}

export function addChild(root, parentId, text = 'New idea') {
  const parent = findNode(root, parentId);
  if (!parent) return null;
  const child = newNode(text);
  parent.children.push(child);
  parent.collapsed = false;
  return child;
}

export function addSibling(root, nodeId, text = 'New idea') {
  if (nodeId === root.id) return addChild(root, root.id, text);
  const parent = findParent(root, nodeId);
  if (!parent) return null;
  const idx = parent.children.findIndex((c) => c.id === nodeId);
  const sibling = newNode(text);
  parent.children.splice(idx + 1, 0, sibling);
  return sibling;
}

export function deleteNode(root, nodeId) {
  if (nodeId === root.id) return false; // cannot delete root
  const parent = findParent(root, nodeId);
  if (!parent) return false;
  parent.children = parent.children.filter((c) => c.id !== nodeId);
  return true;
}

export function setText(root, nodeId, text) {
  const n = findNode(root, nodeId);
  if (n) n.text = text;
}

export function toggleCollapsed(root, nodeId) {
  const n = findNode(root, nodeId);
  if (n && n.children.length) n.collapsed = !n.collapsed;
}

/** Set or clear a priority (1-4). Pass null/undefined/0 to clear. */
export function setPriority(root, nodeId, priority) {
  const n = findNode(root, nodeId);
  if (!n) return;
  if (priority && priority >= 1 && priority <= 4) n.priority = priority;
  else delete n.priority;
}

/** Toggle (or set) the completion flag on a node. */
export function setCompleted(root, nodeId, completed) {
  const n = findNode(root, nodeId);
  if (!n) return;
  if (completed === undefined) completed = !n.completed;
  if (completed) n.completed = true;
  else delete n.completed;
}

/** Move `nodeId` to be a child of `newParentId`. Prevents cycles. */
export function reparent(root, nodeId, newParentId) {
  if (nodeId === root.id) return false;
  if (nodeId === newParentId) return false;
  if (isAncestor(root, nodeId, newParentId)) return false;
  const oldParent = findParent(root, nodeId);
  const newParent = findNode(root, newParentId);
  if (!oldParent || !newParent) return false;
  const idx = oldParent.children.findIndex((c) => c.id === nodeId);
  if (idx === -1) return false;
  const [node] = oldParent.children.splice(idx, 1);
  newParent.children.push(node);
  newParent.collapsed = false;
  // Free positions are recomputed by the active layout.
  delete node.x; delete node.y;
  return true;
}

export function setPosition(root, nodeId, x, y) {
  const n = findNode(root, nodeId);
  if (n) { n.x = x; n.y = y; }
}

export function clone(doc) {
  return JSON.parse(JSON.stringify(doc));
}

/** Validate and (lightly) migrate an incoming document. */
export function loadDocument(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Hive document');
  if (raw.format !== FORMAT) throw new Error(`Unknown format: ${raw.format}`);
  if (typeof raw.version !== 'number') throw new Error('Missing version');
  if (raw.version > VERSION) throw new Error(`Document version ${raw.version} is newer than supported ${VERSION}`);
  const doc = clone(raw);
  doc.layout ||= 'radial';
  doc.viewport ||= { x: 0, y: 0, zoom: 1 };
  doc.meta ||= {};
  doc.meta.theme ||= 'light';
  // Ensure all nodes have ids and children arrays.
  walk(doc.root, (n) => {
    n.id ||= uid();
    n.children ||= [];
  });
  return doc;
}
