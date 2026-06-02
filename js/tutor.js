/**
 * tutor.js — AI Tutor powered by WebLLM (Phi-3 mini)
 *
 * Loads the WebLLM library dynamically from CDN on first use (cached by browser).
 * The Phi-3-mini-4k-instruct model (~2 GB) downloads once and caches in
 * the browser's Cache API — after that it works fully offline.
 *
 * Graceful degradation: if WebGPU is unavailable or the model fails to load,
 * falls back to static hint cards.
 */

import { getTutorHistory, appendTutorMessage, clearTutorHistory } from './db.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL_ID   = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
const WEB_LLM_ESM = 'https://esm.run/@mlc-ai/web-llm';

const SYSTEM_PROMPT = (lessonTitle) =>
  `You are a friendly coding tutor helping beginners in Myanmar learn Python. ` +
  `The student is on this lesson: "${lessonTitle}". ` +
  `Keep answers to 2-4 sentences. Use simple English. Avoid jargon. ` +
  `If the student shares code, identify the specific line that is wrong and explain why in plain terms. ` +
  `Never just give the answer — guide the student to find it themselves.`;

// ─── State ────────────────────────────────────────────────────────────────────

let _engine     = null;   // WebLLM engine
let _status     = 'idle'; // 'idle' | 'loading-lib' | 'loading-model' | 'ready' | 'error' | 'unavailable'
let _panel      = null;
let _fab        = null;
let _isOpen     = false;
let _isThinking = false;

// ─── Public API ───────────────────────────────────────────────────────────────

export function mountTutor(lesson) {
  _cleanup();

  // FAB
  _fab = document.createElement('button');
  _fab.className = 'tutor-fab';
  _fab.innerHTML = `<span aria-hidden="true">✦</span> Ask tutor`;
  _fab.setAttribute('aria-expanded', 'false');
  _fab.setAttribute('aria-controls', 'tutor-panel');
  document.body.appendChild(_fab);

  // Panel
  _panel = document.createElement('aside');
  _panel.className = 'tutor-panel';
  _panel.id = 'tutor-panel';
  _panel.setAttribute('role', 'complementary');
  _panel.setAttribute('aria-label', 'AI tutor');
  _panel.innerHTML = _buildPanelHTML(lesson);
  document.body.appendChild(_panel);

  // Events
  _fab.addEventListener('click', () => _togglePanel(lesson));
  _panel.querySelector('.tutor-close-btn')?.addEventListener('click', _closePanel);
  _panel.querySelector('.tutor-clear-btn')?.addEventListener('click', () => _clearChat(lesson));

  const sendBtn  = _panel.querySelector('.tutor-send-btn');
  const inputEl  = _panel.querySelector('.tutor-input');
  const loadBtn  = _panel.querySelector('.tutor-load-btn');

  if (sendBtn && inputEl) {
    sendBtn.addEventListener('click', () => _handleSend(lesson, inputEl));
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _handleSend(lesson, inputEl); }
    });
    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(120, inputEl.scrollHeight) + 'px';
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', () => _loadModel(lesson));
  }
}

export function cleanup() { _cleanup(); }

function _cleanup() {
  _panel?.remove();
  _fab?.remove();
  _panel = null;
  _fab   = null;
  _isOpen = false;
}

// ─── Panel open/close ─────────────────────────────────────────────────────────

function _togglePanel(lesson) {
  if (_isOpen) { _closePanel(); } else { _openPanel(lesson); }
}

function _openPanel(lesson) {
  if (!_panel || !_fab) return;
  _isOpen = true;
  _panel.classList.add('open');
  _fab.setAttribute('aria-expanded', 'true');
  _panel.querySelector('.tutor-input')?.focus();
  _loadHistory(lesson);
}

function _closePanel() {
  if (!_panel || !_fab) return;
  _isOpen = false;
  _panel.classList.remove('open');
  _fab.setAttribute('aria-expanded', 'false');
}

// ─── Panel HTML ───────────────────────────────────────────────────────────────

function _buildPanelHTML(lesson) {
  const webgpuOk = !!(navigator.gpu);

  return `
    <div class="tutor-header">
      <span class="tutor-title">
        <span class="tutor-status-dot" id="tutor-dot" aria-hidden="true"></span>
        Ask the Tutor
      </span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm tutor-clear-btn" title="Clear chat">Clear</button>
        <button class="tutor-close-btn btn btn-ghost" aria-label="Close tutor">✕</button>
      </div>
    </div>

    <div class="tutor-messages" id="tutor-messages">
      ${_engine ? _buildReadyWelcome(lesson) : _buildNotReadyWelcome(lesson, webgpuOk)}
    </div>

    <div id="tutor-load-progress" class="tutor-load-progress" style="display:none">
      <div class="tutor-load-bar"><div class="tutor-load-fill" id="tutor-load-fill"></div></div>
      <div class="tutor-load-label" id="tutor-load-label">Preparing…</div>
    </div>

    <div class="tutor-input-area" id="tutor-input-area" ${_engine ? '' : 'style="display:none"'}>
      <textarea
        class="tutor-input"
        rows="1"
        placeholder="Ask about this lesson…"
        aria-label="Message the tutor"
      ></textarea>
      <button class="tutor-send-btn" aria-label="Send">Send</button>
    </div>
  `;
}

function _buildNotReadyWelcome(lesson, webgpuOk) {
  if (!webgpuOk) {
    return `
      <div class="tutor-msg tutor-msg--assistant">
        The AI tutor needs <strong>WebGPU</strong>, which is not available in this browser.
        Try Chrome 113+ or Edge 113+ for the full experience.
        <br><br>
        For now, here are some helpful reminders:
      </div>
      ${_buildHintCards()}
    `;
  }

  return `
    <div class="tutor-msg tutor-msg--assistant" id="tutor-welcome">
      Hi! I'm your Python tutor for <strong>${_esc(lesson.title)}</strong>.
      <br><br>
      I run entirely in your browser — no internet needed once loaded.
      The first load downloads ~2 GB, then I work offline forever.
      <br><br>
      <button class="btn btn-primary btn-sm tutor-load-btn" style="margin-top:4px">
        Load AI tutor (needs internet once)
      </button>
    </div>
    ${_buildHintCards()}
  `;
}

function _buildReadyWelcome(lesson) {
  return `
    <div class="tutor-msg tutor-msg--assistant">
      Hi! I'm ready to help with <strong>${_esc(lesson.title)}</strong>.
      Ask me anything about this lesson.
    </div>
  `;
}

function _buildHintCards() {
  const cards = [
    { title: 'Stuck?', body: 'Read the error message carefully — it tells you the line number and what went wrong.' },
    { title: 'Debugging tip', body: 'Add print() before the crash to see what your variables actually contain.' },
    { title: 'Don\'t give up', body: 'Making mistakes is normal. Every programmer gets errors every day.' },
    { title: 'Check your types', body: 'Many bugs come from mixing strings and numbers. Use int() or str() to convert.' },
  ];
  return `
    <div class="hint-cards">
      ${cards.map((c) => `
        <div class="hint-card">
          <div class="hint-card-title">${_esc(c.title)}</div>
          ${_esc(c.body)}
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Model loading ────────────────────────────────────────────────────────────

async function _loadModel(lesson) {
  if (_status === 'loading-model' || _status === 'ready') return;

  _setStatus('loading-lib');
  _showProgress('Fetching WebLLM library…', 0);

  let CreateMLCEngine;
  try {
    const mod = await import(WEB_LLM_ESM);
    CreateMLCEngine = mod.CreateMLCEngine;
  } catch (err) {
    _setStatus('error');
    _hideProgress();
    _appendMsg('assistant', `Could not load WebLLM library. Check your internet connection and try again.\n\n${err.message}`);
    return;
  }

  _setStatus('loading-model');
  _showProgress('Loading Phi-3 mini model…', 0.01);

  try {
    _engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        const pct = report.progress ?? 0;
        _showProgress(report.text ?? 'Loading…', pct);
        const fill = document.getElementById('tutor-load-fill');
        if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
      },
    });
  } catch (err) {
    _setStatus('error');
    _hideProgress();
    _appendMsg('assistant', `Could not load the model: ${err.message}\n\nYou may need to connect to the internet for the first-time download.`);
    return;
  }

  _setStatus('ready');
  _hideProgress();

  // Show input area and welcome
  const inputArea = document.getElementById('tutor-input-area');
  if (inputArea) inputArea.style.display = '';

  const welcome = document.getElementById('tutor-welcome');
  if (welcome) welcome.innerHTML = `
    <strong>AI tutor ready!</strong> I'm ${_esc(lesson.title.split('—')[0].trim())} and I'm here to help.
    Ask me anything about this lesson.
  `;

  _updateStatusDot();
}

function _showProgress(text, pct) {
  const el = document.getElementById('tutor-load-progress');
  if (el) el.style.display = '';
  const label = document.getElementById('tutor-load-label');
  if (label) label.textContent = text;
  const fill = document.getElementById('tutor-load-fill');
  if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
}

function _hideProgress() {
  const el = document.getElementById('tutor-load-progress');
  if (el) el.style.display = 'none';
}

function _setStatus(status) {
  _status = status;
  _updateStatusDot();
}

function _updateStatusDot() {
  const dot = document.getElementById('tutor-dot');
  if (!dot) return;
  dot.className = 'tutor-status-dot';
  if (_status === 'ready')         dot.classList.add('ready');
  else if (_status.startsWith('loading')) dot.classList.add('loading');
}

// ─── Chat ──────────────────────────────────────────────────────────────────────

async function _handleSend(lesson, inputEl) {
  if (_isThinking) return;
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  _appendMsg('user', text);
  await appendTutorMessage(lesson.id, { role: 'user', content: text });

  if (!_engine) {
    _appendMsg('assistant', 'The AI tutor is not loaded yet. Click "Load AI tutor" above to get started.');
    return;
  }

  _isThinking = true;
  const typing = _appendTypingIndicator();

  try {
    const history = await getTutorHistory(lesson.id);

    const messages = [
      { role: 'system',    content: SYSTEM_PROMPT(lesson.title) },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];

    // Streaming response
    const stream = await _engine.chat.completions.create({ messages, stream: true });

    let reply = '';
    const replyEl = document.createElement('div');
    replyEl.className = 'tutor-msg tutor-msg--assistant';

    typing.replaceWith(replyEl);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      reply += delta;
      replyEl.textContent = reply;
      const msgs = document.getElementById('tutor-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    await appendTutorMessage(lesson.id, { role: 'assistant', content: reply });
  } catch (err) {
    typing.remove();
    _appendMsg('assistant', `Sorry, something went wrong: ${err.message}`);
  } finally {
    _isThinking = false;
  }
}

async function _loadHistory(lesson) {
  const messages = await getTutorHistory(lesson.id);
  if (messages.length === 0) return;

  const msgsEl = document.getElementById('tutor-messages');
  if (!msgsEl) return;

  msgsEl.innerHTML = '';
  messages.forEach((m) => _appendMsg(m.role, m.content));
}

async function _clearChat(lesson) {
  await clearTutorHistory(lesson.id);
  const msgsEl = document.getElementById('tutor-messages');
  if (msgsEl) msgsEl.innerHTML = _engine ? _buildReadyWelcome(lesson) : _buildNotReadyWelcome(lesson, !!navigator.gpu);
}

function _appendMsg(role, content) {
  const msgsEl = document.getElementById('tutor-messages');
  if (!msgsEl) return null;
  const div = document.createElement('div');
  div.className = `tutor-msg tutor-msg--${role}`;
  div.textContent = content;
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return div;
}

function _appendTypingIndicator() {
  const msgsEl = document.getElementById('tutor-messages');
  const el = document.createElement('div');
  el.className = 'tutor-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  msgsEl?.appendChild(el);
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  return el;
}

// ─── Util ──────────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
