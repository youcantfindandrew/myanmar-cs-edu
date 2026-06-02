/**
 * editor.js — CodeMirror 6 integration (Phase 2)
 *
 * Phase 1: exercises use a plain <textarea> with basic tab handling.
 * Phase 2: swap in CodeMirror 6 from vendor/codemirror/.
 *
 * This module exports a single factory that upgrades any .exercise-textarea
 * inside the given container to a fully-featured editor.
 */

/**
 * Enhance all exercise textareas in `container` with tab-indent support.
 * Full CM6 integration will replace this in Phase 2.
 */
export function initEditors(container) {
  container.querySelectorAll('.exercise-textarea').forEach((ta) => {
    // Prevent Tab from moving focus — insert 4 spaces instead
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end   = ta.selectionEnd;
        ta.value = ta.value.slice(0, start) + '    ' + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
      }
    });

    // Auto-indent on Enter: match previous line's leading whitespace
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const pos  = ta.selectionStart;
        const text = ta.value;
        const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
        const line      = text.slice(lineStart, pos);
        const indent    = line.match(/^(\s*)/)[1];
        // Extra indent after colon
        const extra = line.trimEnd().endsWith(':') ? '    ' : '';
        const insert = '\n' + indent + extra;
        ta.value = text.slice(0, pos) + insert + text.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = pos + insert.length;
      }
    });

    // Auto-resize textarea as content grows
    ta.style.minHeight = '120px';
    ta.style.resize = 'none';
    ta.style.width  = '100%';
    ta.style.padding = '14px 16px';
    ta.style.fontFamily = 'var(--font-mono)';
    ta.style.fontSize   = '14px';
    ta.style.lineHeight = '1.7';
    ta.style.color      = 'var(--text-primary)';
    ta.style.background = 'var(--code-bg)';
    ta.style.border     = 'none';
    ta.style.outline    = 'none';
    ta.style.tabSize    = '4';

    function autoResize() {
      ta.style.height = 'auto';
      ta.style.height = Math.max(120, ta.scrollHeight) + 'px';
    }
    ta.addEventListener('input', autoResize);
    autoResize();
  });
}
