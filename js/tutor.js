/**
 * tutor.js — AI tutor (WebLLM / Phi-3 mini — Phase 2)
 *
 * Phase 1: renders a "tutor not ready" placeholder with static hint cards.
 * Phase 2: loads WebLLM, streams Phi-3 mini responses in-browser.
 *
 * The tutor panel is a slide-out drawer on the right side of the lesson page.
 */

import { getTutorHistory, appendTutorMessage, clearTutorHistory } from './db.js';

const SYSTEM_PROMPT_TEMPLATE = (lessonTitle) =>
  `You are a friendly coding tutor helping beginners in Myanmar learn Python.
The student is currently on this lesson: ${lessonTitle}.
Keep answers short (2–4 sentences max). Use simple English. Avoid jargon.
If the student shares code, identify the specific line that is wrong and explain why in plain terms.
Never just give the answer — guide the student to find it themselves.`;

// ─── Panel lifecycle ─────────────────────────────────────────────────────────

let _panel = null;
let _isOpen = false;

/**
 * Mount the tutor FAB and panel for a lesson page.
 * Called by app.js after lesson content is rendered.
 */
export function mountTutor(lesson) {
  cleanup();

  // FAB
  const fab = document.createElement('button');
  fab.className = 'tutor-fab';
  fab.innerHTML = `<span>✦</span> Ask tutor`;
  fab.setAttribute('aria-label', 'Open AI tutor');
  fab.setAttribute('aria-expanded', 'false');
  document.body.appendChild(fab);

  // Panel
  _panel = document.createElement('aside');
  _panel.className = 'tutor-panel';
  _panel.setAttribute('role', 'complementary');
  _panel.setAttribute('aria-label', 'AI tutor');
  _panel.innerHTML = buildPanelHTML(lesson);
  document.body.appendChild(_panel);

  fab.addEventListener('click', () => togglePanel(fab, lesson));

  // Close button
  _panel.querySelector('.tutor-close-btn')?.addEventListener('click', () => {
    closePanel(fab);
  });

  // Clear history button
  _panel.querySelector('.tutor-clear-btn')?.addEventListener('click', async () => {
    await clearTutorHistory(lesson.id);
    const msgContainer = _panel.querySelector('.tutor-messages');
    if (msgContainer) msgContainer.innerHTML = buildWelcomeMessage(lesson);
  });

  // Message send
  const sendBtn   = _panel.querySelector('.tutor-send-btn');
  const inputEl   = _panel.querySelector('.tutor-input');
  if (sendBtn && inputEl) {
    const send = () => handleSend(lesson, inputEl);
    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }
}

export function cleanup() {
  _panel?.remove();
  document.querySelector('.tutor-fab')?.remove();
  _panel = null;
  _isOpen = false;
}

function togglePanel(fab, lesson) {
  if (_isOpen) { closePanel(fab); } else { openPanel(fab, lesson); }
}

function openPanel(fab, lesson) {
  _isOpen = true;
  _panel?.classList.add('open');
  fab.setAttribute('aria-expanded', 'true');
  // Load persisted history
  loadHistory(lesson);
}

function closePanel(fab) {
  _isOpen = false;
  _panel?.classList.remove('open');
  document.querySelector('.tutor-fab')?.setAttribute('aria-expanded', 'false');
}

// ─── Panel HTML ──────────────────────────────────────────────────────────────

function buildPanelHTML(lesson) {
  return `
    <div class="tutor-header">
      <span class="tutor-title">
        <span class="tutor-status-dot" aria-hidden="true"></span>
        Ask the Tutor
      </span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn btn-ghost btn-sm tutor-clear-btn" title="Clear chat history">Clear</button>
        <button class="tutor-close-btn btn btn-ghost" aria-label="Close tutor panel">✕</button>
      </div>
    </div>

    <div class="tutor-messages">
      ${buildWelcomeMessage(lesson)}
    </div>

    <div class="tutor-input-area">
      <textarea
        class="tutor-input"
        rows="1"
        placeholder="Ask a question about this lesson…"
        aria-label="Ask the tutor"
      ></textarea>
      <button class="tutor-send-btn" aria-label="Send message">Send</button>
    </div>
  `;
}

function buildWelcomeMessage(lesson) {
  return `
    <div class="tutor-msg tutor-msg--assistant">
      Hi! I'm your tutor for "<strong>${escapeHtml(lesson.title)}</strong>".
      Ask me anything about this lesson — concepts, code, or if you're stuck.
      <br><br>
      <small style="color:var(--text-faint)">
        Note: The AI tutor (Phi-3 mini) requires a one-time ~2 GB download.
        For now, you'll get hints from pre-written cards below.
      </small>
    </div>
    ${buildHintCards(lesson)}
  `;
}

function buildHintCards(lesson) {
  // Static helpful prompts for each lesson — Phase 2 replaces with live AI
  const hints = [
    `Try re-reading the last code example slowly, line by line.`,
    `Write down what you think each line does, then check if you were right.`,
    `If your code has an error, look at the line number in the error message.`,
    `It's okay to make mistakes — every programmer does. Try again!`,
  ];
  return `
    <div class="hint-cards">
      <div class="hint-card">
        <div class="hint-card-title">Helpful reminders</div>
        <ul style="padding-left:16px;margin:0;display:flex;flex-direction:column;gap:6px">
          ${hints.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

// ─── Message handling ────────────────────────────────────────────────────────

async function handleSend(lesson, inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';

  const messagesEl = _panel?.querySelector('.tutor-messages');
  if (!messagesEl) return;

  // Append user message to UI
  appendMessageToUI(messagesEl, 'user', text);
  await appendTutorMessage(lesson.id, { role: 'user', content: text });

  // Phase 1: echo with a static response
  // Phase 2: stream from WebLLM
  const typing = appendTypingIndicator(messagesEl);
  await delay(600); // simulate thinking
  typing.remove();

  const reply = `I'm still learning to think! (AI responses will be available once Phi-3 mini is loaded.) ` +
    `For now, re-read the lesson section and try the exercise again.`;
  appendMessageToUI(messagesEl, 'assistant', reply);
  await appendTutorMessage(lesson.id, { role: 'assistant', content: reply });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessageToUI(container, role, content) {
  const div = document.createElement('div');
  div.className = `tutor-msg tutor-msg--${role}`;
  div.textContent = content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator(container) {
  const el = document.createElement('div');
  el.className = 'tutor-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

async function loadHistory(lesson) {
  const messages = await getTutorHistory(lesson.id);
  if (messages.length === 0) return;

  const messagesEl = _panel?.querySelector('.tutor-messages');
  if (!messagesEl) return;

  // Clear placeholder and show history
  messagesEl.innerHTML = '';
  messages.forEach((msg) => appendMessageToUI(messagesEl, msg.role, msg.content));
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
