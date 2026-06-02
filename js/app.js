/**
 * app.js — Entry point
 *
 * 1. Registers the service worker
 * 2. Checks for file:// protocol (USB mode) and shows a notice if needed
 * 3. Initialises the router and wires up all views
 * 4. Handles mobile nav toggle
 */

import { Router }      from './router.js';
import { renderHome, renderLesson } from './lessons.js';
import { renderStats } from './stats.js';
import { initEditors, initPyodide, installGlobals } from './editor.js';
import { mountTutor, cleanup as cleanupTutor } from './tutor.js';
import { getStudent }  from './db.js';

// Boot Pyodide sandbox in the background immediately so it's ready when
// a student opens their first exercise. installGlobals() wires up
// window._runPythonCode which bindSectionEvents reads lazily.
installGlobals();
initPyodide();

// ─── Service worker registration ─────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.warn('[SW] Registration failed:', err);
  });
} else if (location.protocol === 'file:') {
  // USB mode — service workers can't run on file://
  showOfflineNotice();
}

function showOfflineNotice() {
  const notice = document.getElementById('offline-notice');
  if (notice) {
    notice.hidden = false;
    document.getElementById('offline-notice-close')?.addEventListener('click', () => {
      notice.hidden = true;
      localStorage.setItem('offline-notice-dismissed', '1');
    });
  }
}

if (localStorage.getItem('offline-notice-dismissed') === '1') {
  const notice = document.getElementById('offline-notice');
  if (notice) notice.hidden = true;
}

// ─── Mobile nav ───────────────────────────────────────────────────────────────

const menuToggle = document.getElementById('menu-toggle');
const appNav     = document.getElementById('app-nav');

menuToggle?.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  appNav.classList.toggle('open', !expanded);
});

// Close nav when a link is clicked
appNav?.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    menuToggle?.setAttribute('aria-expanded', 'false');
    appNav.classList.remove('open');
  }
});

// ─── Router ───────────────────────────────────────────────────────────────────

const main = document.getElementById('main-content');

const router = new Router({
  home: async () => {
    cleanupTutor();
    await renderHome(main);
  },

  lesson: async (id) => {
    if (!id) { router.navigate('home'); return; }
    cleanupTutor();
    await renderLesson(id, main);
    initEditors(main);
    // Load the lesson JSON again for the tutor (already cached)
    try {
      const { loadLesson } = await import('./lessons.js');
      const lesson = await loadLesson(id);
      mountTutor(lesson);
    } catch (e) {
      console.warn('[Tutor] Could not mount:', e);
    }
  },

  stats: async () => {
    cleanupTutor();
    await renderStats(main);
  },

  setup: async () => {
    cleanupTutor();
    await renderSetup(main);
  },

  about: () => {
    cleanupTutor();
    renderAbout(main);
  },

  '404': () => {
    cleanupTutor();
    main.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">404</div>
        <h3>Page not found</h3>
        <p>That route doesn't exist.</p>
        <a href="#home" class="btn btn-secondary" style="margin-top:16px;">Go home</a>
      </div>`;
  },
});

// ─── Setup page ───────────────────────────────────────────────────────────────

async function renderSetup(container) {
  const student = await getStudent();

  container.innerHTML = `
    <div class="page-header">
      <h1>Set up your profile</h1>
      <p>Optional — helps your teacher identify your progress exports.</p>
    </div>
    <form class="setup-form" id="setup-form" novalidate>
      <div class="form-group">
        <label for="student-name">Your name</label>
        <input
          type="text" id="student-name" name="name"
          placeholder="e.g. Ma Aye Aye"
          value="${escapeHtml(student.name ?? '')}"
          maxlength="80" autocomplete="given-name"
        >
        <p class="form-hint">Only stored on this device — never sent anywhere.</p>
      </div>
      <div class="form-group">
        <label for="device-label">Computer label</label>
        <input
          type="text" id="device-label" name="deviceLabel"
          placeholder="e.g. Computer 3"
          value="${escapeHtml(student.deviceLabel ?? '')}"
          maxlength="40"
        >
        <p class="form-hint">Useful if many students share the same class computers.</p>
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">
        <button type="submit" class="btn btn-primary">Save and continue</button>
        <a href="#home" class="btn btn-ghost">Skip for now</a>
      </div>
    </form>
  `;

  container.querySelector('#setup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { setStudentName, setDeviceLabel } = await import('./db.js');
    const name  = container.querySelector('#student-name').value;
    const label = container.querySelector('#device-label').value;
    await setStudentName(name);
    await setDeviceLabel(label);
    router.navigate('home');
  });
}

// ─── About page ───────────────────────────────────────────────────────────────

function renderAbout(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>About</h1>
    </div>
    <div class="about-content">
      <blockquote class="about-quote">
        "Most projects live on GitHub. This one runs on a USB drive in a classroom in Yangon.
        I didn't build it to add a line to my resume — I built it because I watched students
        who had everything to gain from CS education and nothing to run it on.
        The offline constraint wasn't a limitation. It was the whole point."
      </blockquote>

      <h2>What this is</h2>
      <p>
        Code Myanmar is a fully offline CS education platform for students in Myanmar
        who have no reliable internet access. It runs from a USB drive, requires no server,
        no account, and no cloud dependency — ever.
      </p>
      <p>
        13 Python lessons take a complete beginner from "what is code?" to writing their first
        real programs. Every lesson works in airplane mode. Progress is saved locally and can
        be exported as a CSV for teachers to review.
      </p>

      <h2>How to use offline</h2>
      <p>
        Copy the entire app folder to a USB drive. On a classroom computer, open a terminal in
        that folder and run:
      </p>
      <div class="code-block" style="max-width:400px;margin-bottom:16px">
        <pre style="padding:14px 18px;font-size:14px"><code>python3 -m http.server 8080</code></pre>
      </div>
      <p>
        Then open <code>http://localhost:8080</code> in Chrome.
        A <code>START.bat</code> file in the USB root does this automatically on Windows.
      </p>

      <h2>The AI tutor</h2>
      <p>
        The AI tutor uses <strong>Phi-3 mini</strong>, a small language model that runs entirely
        in the browser — no API key, no server. It requires a one-time ~2 GB download, then
        works completely offline. Your conversations are stored only on your device.
      </p>

      <h2>Built by</h2>
      <p>
        Andrew Lwin — teaching kids to code in Myanmar since 2023.
        <a href="https://github.com/youcantfindandrew/myanmar-cs-edu" target="_blank" rel="noopener">
          View on GitHub
        </a>
      </p>
    </div>
  `;
}

// ─── Util ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── First-launch redirect ────────────────────────────────────────────────────

(async () => {
  // On first ever visit, offer the setup page once
  if (!localStorage.getItem('setup-done') && !window.location.hash) {
    const { getStudent } = await import('./db.js');
    const student = await getStudent();
    if (!student.name) {
      // Don't force — just let them land on home
      localStorage.setItem('setup-done', '1');
    }
  }
})();
