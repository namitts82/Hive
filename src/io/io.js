// File I/O: save / open via File System Access API with download/upload fallback.
// Also handles localStorage autosave.
import { loadDocument, FORMAT, VERSION } from '../core/model.js';

const AUTOSAVE_KEY = 'hive:autosave:v1';
const FILE_TYPE = {
  description: 'Hive mind map',
  accept: { 'application/json': ['.hmap.json', '.json'] },
};

export class IOService {
  constructor() {
    this.fileHandle = null;
  }

  serialize(doc) {
    doc.meta.updatedAt = new Date().toISOString();
    // Keep title in sync with the central node so saved files are named meaningfully.
    if (doc.root?.text) doc.meta.title = doc.root.text;
    doc.format = FORMAT;
    doc.version = VERSION;
    return JSON.stringify(doc, null, 2);
  }

  parse(text) {
    return loadDocument(JSON.parse(text));
  }

  hasFsAccess() {
    return typeof window.showSaveFilePicker === 'function';
  }

  suggestedFilename(doc) {
    const raw = (doc.root?.text || doc.meta?.title || 'mindmap').trim();
    const safe = raw
      .replace(/[\\/:*?"<>|]+/g, ' ')   // strip filesystem-illegal chars
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'mindmap';
    return safe + '.hmap.json';
  }

  async saveAs(doc) {
    const data = this.serialize(doc);
    const suggested = this.suggestedFilename(doc);
    if (this.hasFsAccess()) {
      this.fileHandle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [FILE_TYPE],
      });
      await this.writeHandle(data);
      return this.fileHandle.name;
    }
    this.downloadBlob(suggested, data);
    return suggested;
  }

  async save(doc) {
    const data = this.serialize(doc);
    if (this.fileHandle && this.hasFsAccess()) {
      await this.writeHandle(data);
      return this.fileHandle.name;
    }
    return this.saveAs(doc);
  }

  async writeHandle(data) {
    const writable = await this.fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
  }

  downloadBlob(name, data) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async openWithPicker() {
    if (this.hasFsAccess()) {
      const [handle] = await window.showOpenFilePicker({ types: [FILE_TYPE], multiple: false });
      this.fileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      return { doc: this.parse(text), name: file.name };
    }
    // Fallback: <input type=file>
    return new Promise((resolve, reject) => {
      const input = document.getElementById('file-input');
      const onChange = async () => {
        input.removeEventListener('change', onChange);
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file selected'));
        try {
          const text = await file.text();
          resolve({ doc: this.parse(text), name: file.name });
        } catch (e) { reject(e); }
        input.value = '';
      };
      input.addEventListener('change', onChange);
      input.click();
    });
  }

  autosave(doc) {
    try { localStorage.setItem(AUTOSAVE_KEY, this.serialize(doc)); } catch { /* quota */ }
  }

  loadAutosave() {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    try { return this.parse(raw); } catch { return null; }
  }

  clearAutosave() { localStorage.removeItem(AUTOSAVE_KEY); }
}
