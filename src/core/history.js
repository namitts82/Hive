// Undo/redo via snapshot stack of the document.
import { clone } from './model.js';

export class History {
  constructor(limit = 100) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }

  push(doc) {
    this.past.push(clone(doc));
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }

  canUndo() { return this.past.length > 1; }
  canRedo() { return this.future.length > 0; }

  undo(currentDoc) {
    if (!this.canUndo()) return null;
    const current = this.past.pop();
    this.future.push(current);
    return clone(this.past[this.past.length - 1]);
  }

  redo() {
    if (!this.canRedo()) return null;
    const next = this.future.pop();
    this.past.push(clone(next));
    return clone(next);
  }

  reset(doc) {
    this.past = [clone(doc)];
    this.future = [];
  }
}
