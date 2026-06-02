/**
 * editor.js — CodeMirror 6 integration + Pyodide Python sandbox
 *
 * Phase 2 implementation. Requires vendor/codemirror/codemirror.min.js to be
 * loaded (added to index.html as a regular <script>). Falls back gracefully
 * to the plain textarea if CM6 is not available.
 *
 * Public API:
 *   initEditors(container)           — upgrade all .exercise-host elements
 *   initPyodide()                    — create the hidden sandbox iframe
 *   pyodideState                     — reactive state: 'idle'|'loading'|'ready'|'error'
 *   onPyodideStateChange(fn)         — subscribe to state changes
 */

// ─── Pyodide sandbox ─────────────────────────────────────────────────────────

let _sandboxFrame  = null;
let _pyodideReady  = false;
let _loadStarted   = false;
const _runQueue    = new Map();          // id → { resolve, outputEl }
const _stateListeners = new Set();

export const pyodideState = { value: 'idle' };

function _setState(state, extra = {}) {
  pyodideState.value = state;
  _stateListeners.forEach((fn) => fn(state, extra));
}

export function onPyodideStateChange(fn) {
  _stateListeners.add(fn);
  return () => _stateListeners.delete(fn);
}

/**
 * Create the hidden Pyodide iframe. Safe to call multiple times.
 * Resolves when the iframe is attached (loading begins in the background).
 */
export function initPyodide() {
  if (_loadStarted) return;
  _loadStarted = true;
  _setState('loading');

  _sandboxFrame = document.createElement('iframe');
  _sandboxFrame.src = './pyodide-sandbox.html';
  _sandboxFrame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  _sandboxFrame.style.cssText = 'position:absolute;width:1px;height:1px;top:-9999px;left:-9999px;border:none;';
  _sandboxFrame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_sandboxFrame);

  window.addEventListener('message', _handleSandboxMessage);
}

function _handleSandboxMessage(e) {
  if (!_sandboxFrame || e.source !== _sandboxFrame.contentWindow) return;
  const msg = e.data;
  if (!msg) return;

  switch (msg.type) {
    case 'ready':
      _pyodideReady = true;
      _setState('ready');
      // Update all loading indicators on the page
      document.querySelectorAll('.pyodide-loader').forEach((el) => {
        el.classList.add('pyodide-loader--ready');
        el.innerHTML = `<span style="color:var(--success);font-size:12px">✓ Python ready</span>`;
      });
      break;

    case 'loading': {
      const pct = Math.round((msg.progress ?? 0) * 100);
      document.querySelectorAll('.pyodide-progress-fill').forEach((fill) => {
        fill.style.width = `${pct}%`;
      });
      document.querySelectorAll('.pyodide-load-text').forEach((el) => {
        el.textContent = msg.text ?? '';
      });
      break;
    }

    case 'result': {
      const entry = _runQueue.get(msg.id);
      if (entry) {
        _runQueue.delete(msg.id);
        entry.resolve(msg);
      }
      break;
    }

    case 'load-error':
      _setState('error', { message: msg.message });
      document.querySelectorAll('.pyodide-loader').forEach((el) => {
        el.innerHTML = `<span style="color:var(--error);font-size:12px">⚠ ${msg.message}</span>`;
      });
      break;
  }
}

/**
 * Run Python code in the sandbox.
 * @param {string} code
 * @returns {Promise<{stdout:string, stderr:string, error:string|null}>}
 */
export function runPythonCode(code) {
  return new Promise((resolve) => {
    if (!_sandboxFrame) {
      resolve({ stdout: '', stderr: '', error: 'Python runtime not initialised.' });
      return;
    }
    if (!_pyodideReady) {
      // Queue it — the sandbox will drain the queue once ready
      const id = _uid();
      _runQueue.set(id, { resolve });
      // Send anyway; sandbox will queue on its side too
      _sandboxFrame.contentWindow?.postMessage({ type: 'run', code, id }, '*');
      return;
    }
    const id = _uid();
    _runQueue.set(id, { resolve });
    _sandboxFrame.contentWindow.postMessage({ type: 'run', code, id }, '*');
  });
}

// Set global so lessons.js can use it without an import cycle
// (lessons.js runs before editor.js is initialised)
export function installGlobals() {
  window._runPythonCode = runPythonCode;
  window._pyodideState  = pyodideState;
}

// ─── CodeMirror 6 editor init ────────────────────────────────────────────────

/**
 * Upgrade all .exercise-host elements inside `container` to CM6 editors.
 * Falls back gracefully to styled textareas if CM6 bundle is not loaded.
 */
export function initEditors(container) {
  const hosts = container.querySelectorAll('.exercise-host');
  hosts.forEach((host) => _upgradeEditor(host));
}

function _upgradeEditor(host) {
  const starter    = host.dataset.starter ?? '';
  const textareaEl = host.querySelector('.exercise-textarea');

  if (!window.CMEditor) {
    // CM6 not loaded — enhance the plain textarea instead
    _enhanceTextarea(textareaEl ?? _makeTextarea(host, starter));
    return;
  }

  // Hide the fallback textarea but keep it for read/reset compatibility
  if (textareaEl) {
    textareaEl.style.display = 'none';
    textareaEl.setAttribute('aria-hidden', 'true');
  }

  // Container for CM6
  const cmWrapper = document.createElement('div');
  cmWrapper.className = 'cm-host';
  cmWrapper.style.cssText = 'min-height:140px;';
  host.insertBefore(cmWrapper, host.firstChild);

  const view = window.CMEditor.createEditor(cmWrapper, starter, (code) => {
    if (textareaEl) textareaEl.value = code;
  });

  // Store on DOM node so anything can grab it
  host._editorView = view;

  // Ctrl+Enter → run
  cmWrapper.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      host.closest('.section-exercise')
          ?.querySelector('.exercise-run')
          ?.click();
    }
  });
}

function _makeTextarea(host, value) {
  const ta = document.createElement('textarea');
  ta.className = 'exercise-textarea';
  ta.value = value;
  host.appendChild(ta);
  return ta;
}

function _enhanceTextarea(ta) {
  if (!ta) return;
  ta.style.cssText = [
    'width:100%; min-height:130px; resize:none;',
    'padding:14px 16px; font-family:var(--font-mono); font-size:14px;',
    'line-height:1.7; color:var(--text-primary); background:var(--code-bg);',
    'border:none; outline:none; tab-size:4;',
  ].join('');

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 4;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const pos       = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf('\n', pos - 1) + 1;
      const line      = ta.value.slice(lineStart, pos);
      const indent    = line.match(/^(\s*)/)[1];
      const extra     = line.trimEnd().endsWith(':') ? '    ' : '';
      const ins       = '\n' + indent + extra;
      ta.value = ta.value.slice(0, pos) + ins + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = pos + ins.length;
    }
  });

  const resize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.max(130, ta.scrollHeight) + 'px';
  };
  ta.addEventListener('input', resize);
  resize();
}

/** Read current code from an exercise wrapper regardless of editor type */
export function readCode(exerciseEl) {
  const host = exerciseEl.querySelector('.exercise-host');
  if (host?._editorView) {
    return window.CMEditor.getEditorContent(host._editorView);
  }
  return exerciseEl.querySelector('.exercise-textarea')?.value ?? '';
}

/** Reset an exercise back to starter code */
export function resetCode(exerciseEl) {
  const host    = exerciseEl.querySelector('.exercise-host');
  const starter = host?.dataset.starter ?? '';
  if (host?._editorView) {
    window.CMEditor.setEditorContent(host._editorView, starter);
  }
  const ta = exerciseEl.querySelector('.exercise-textarea');
  if (ta) ta.value = starter;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function _uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
