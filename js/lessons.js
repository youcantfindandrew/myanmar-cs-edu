/**
 * lessons.js — Lesson loader and renderer
 *
 * Handles:
 *  - Loading lessons/index.json and individual lesson JSON files
 *  - Rendering the home screen lesson grid
 *  - Rendering each section type: text, code-demo, quiz, exercise
 *  - Section-by-section navigation within a lesson
 */

import { getProgress, setProgress } from './db.js';
import { markLessonStarted, markLessonCompleted, recordQuizAnswer,
         recordExerciseAttempt, saveLastSection, addTimeSpent } from './progress.js';
import { getLang, t } from './lang.js';

// ─── Lesson loading ──────────────────────────────────────────────────────────

let _lessonIndex = null;

export async function loadLessonIndex() {
  if (_lessonIndex) return _lessonIndex;
  const lang = getLang();
  if (lang !== 'en') {
    try {
      const res = await fetch(`./lessons/${lang}/index.json`);
      if (res.ok) { _lessonIndex = await res.json(); return _lessonIndex; }
    } catch (_) {}
  }
  const res = await fetch('./lessons/index.json');
  _lessonIndex = await res.json();
  return _lessonIndex;
}

const _lessonCache = new Map();

export async function loadLesson(id) {
  if (_lessonCache.has(id)) return _lessonCache.get(id);
  const lang = getLang();
  if (lang !== 'en') {
    try {
      const res = await fetch(`./lessons/${lang}/${id}.json`);
      if (res.ok) {
        const lesson = await res.json();
        _lessonCache.set(id, lesson);
        return lesson;
      }
    } catch (_) {}
  }
  const res    = await fetch(`./lessons/${id}.json`);
  const lesson = await res.json();
  _lessonCache.set(id, lesson);
  return lesson;
}

// ─── Home screen ─────────────────────────────────────────────────────────────

export async function renderHome(container) {
  const [index, allProgress] = await Promise.all([
    loadLessonIndex(),
    import('./db.js').then((m) => m.getAllProgress()),
  ]);

  const progressMap = new Map(allProgress.map((p) => [p.lessonId, p]));

  const completedCount = [...progressMap.values()].filter(p => p.status === 'completed').length;

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('homeTitle')}</h1>
      <p>${t('homeSubtitle')}</p>
    </div>
    ${completedCount > 0 ? `
    <div class="home-stats-bar">
      <span>${completedCount} / ${index.length} ${t('lessonsCompleted')}</span>
      <a href="#stats" class="btn btn-ghost btn-sm">${t('viewProgress')}</a>
    </div>` : ''}
    <div class="home-search-wrap">
      <input
        type="search"
        id="lesson-search"
        placeholder="${t('searchPlaceholder')}"
        aria-label="${t('searchPlaceholder')}"
        class="lesson-search-input"
      >
    </div>
    <div class="lesson-grid" id="lesson-grid"></div>
    <p id="no-results" hidden style="color:var(--text-muted);text-align:center;margin-top:32px">${t('noResults')}</p>
  `;

  const grid = container.querySelector('#lesson-grid');
  const cards = [];

  index.forEach((lesson) => {
    const progress = progressMap.get(lesson.id);
    const status   = progress?.status ?? 'not-started';
    const card     = buildLessonCard(lesson, status, progress);
    grid.appendChild(card);
    cards.push({ card, lesson });
  });

  // Live search filter
  container.querySelector('#lesson-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    let visible = 0;
    cards.forEach(({ card, lesson }) => {
      const match = !q ||
        lesson.title.toLowerCase().includes(q) ||
        lesson.description.toLowerCase().includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    const noResults = container.querySelector('#no-results');
    if (noResults) noResults.hidden = visible > 0;
  });
}

function buildLessonCard(lesson, status, progress) {
  const pct = status === 'completed' ? 100
            : status === 'in-progress' ? 50 : 0;

  const statusLabel = {
    'not-started': 'Not started',
    'in-progress':  'In progress',
    'completed':    'Completed',
  }[status] ?? 'Not started';

  const card = document.createElement('a');
  card.href  = `#lesson/${lesson.id}`;
  card.className = `lesson-card ${status}`;
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${lesson.title} — ${statusLabel}`);

  card.innerHTML = `
    <div class="lesson-card-header">
      <span class="lesson-number">Lesson ${lesson.order ?? lesson.id.split('-')[0]}</span>
      ${buildProgressRing(pct, status)}
    </div>
    <h3>${escapeHtml(lesson.title)}</h3>
    <p>${escapeHtml(lesson.description)}</p>
    <div class="lesson-card-footer">
      <span class="lesson-duration">~${lesson.estimatedMinutes ?? 20} min</span>
      <span class="lesson-status-badge badge--${status}">${statusLabel}</span>
    </div>
  `;

  return card;
}

function buildProgressRing(pct, status) {
  const r = 14;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const accentClass = status === 'in-progress' ? 'progress-ring--accent' : '';

  const icon = status === 'completed' ? '✓' : '';

  return `
    <div class="progress-ring ${accentClass}" aria-hidden="true">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle class="progress-ring__track" cx="18" cy="18" r="${r}"/>
        <circle class="progress-ring__fill"
          cx="18" cy="18" r="${r}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
        />
      </svg>
      ${icon ? `<span class="progress-ring__icon">${icon}</span>` : ''}
    </div>
  `;
}

// ─── Lesson viewer ───────────────────────────────────────────────────────────

export async function renderLesson(lessonId, container) {
  let lesson;
  try {
    lesson = await loadLesson(lessonId);
  } catch {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠</div>
        <h3>Lesson not found</h3>
        <p>Could not load lesson "${escapeHtml(lessonId)}".</p>
        <a href="#home" class="btn btn-secondary" style="margin-top:16px;">Back to lessons</a>
      </div>`;
    return;
  }

  await markLessonStarted(lessonId);
  const progress = await getProgress(lessonId);
  const startSection = progress.lastSectionIndex ?? 0;

  // Build the full lesson layout
  container.innerHTML = buildLessonLayout(lesson);

  const contentEl  = container.querySelector('.lesson-content');
  const fillEl     = container.querySelector('.lesson-progress-fill');
  const counterEl  = container.querySelector('.lesson-section-counter');

  let currentSection = startSection;
  const total        = lesson.sections.length;

  // Timer
  let sessionSeconds = 0;
  const timerInterval = setInterval(() => { sessionSeconds++; }, 1000);
  window.addEventListener('beforeunload', () => {
    clearInterval(timerInterval);
    addTimeSpent(lessonId, sessionSeconds);
  }, { once: true });

  // Lesson quiz score tracking
  let quizScore = progress.quizScore ?? 0;
  let quizTotal = progress.quizTotal ?? 0;

  function updateProgressBar(idx) {
    const pct = Math.round(((idx) / total) * 100);
    if (fillEl)   fillEl.style.width = `${pct}%`;
    if (counterEl) counterEl.textContent = `${idx + 1} / ${total}`;
  }

  async function showSection(idx) {
    if (idx < 0 || idx >= total) return;
    currentSection = idx;
    updateProgressBar(idx);
    await saveLastSection(lessonId, idx);

    const section = lesson.sections[idx];
    const isLast  = idx === total - 1;

    // Render section into .lesson-content (below the header)
    const headerEl = contentEl.querySelector('.lesson-header');
    const sectionWrapper = contentEl.querySelector('.section-wrapper') ?? (() => {
      const el = document.createElement('div');
      el.className = 'section-wrapper';
      contentEl.appendChild(el);
      return el;
    })();

    sectionWrapper.innerHTML = renderSection(section, idx, total);

    // Nav buttons
    const navEl = contentEl.querySelector('.section-nav');
    if (navEl) {
      navEl.innerHTML = buildSectionNav(idx, total, isLast);
      bindNavEvents(navEl, idx, isLast, lesson, lessonId);
    }

    // Bind interactive section elements
    bindSectionEvents(sectionWrapper, section, lessonId, () => {
      // On quiz answered
      quizTotal++;
    }, (isCorrect) => {
      if (isCorrect) quizScore++;
      // Persist immediately
      setProgress(lessonId, { quizScore, quizTotal });
    });

    // Scroll to top of content
    contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bindNavEvents(navEl, idx, isLast, lesson, lessonId) {
    navEl.querySelector('.nav-prev')?.addEventListener('click', () => {
      showSection(idx - 1);
    });
    navEl.querySelector('.nav-next')?.addEventListener('click', async () => {
      if (isLast) {
        clearInterval(timerInterval);
        await addTimeSpent(lessonId, sessionSeconds);
        sessionSeconds = 0;
        await markLessonCompleted(lessonId, quizScore, quizTotal);
        showCompleteBanner(contentEl, lesson);
      } else {
        showSection(idx + 1);
      }
    });
  }

  await showSection(currentSection);
  updateProgressBar(currentSection);
}

function buildLessonLayout(lesson) {
  return `
    <div class="lesson-page">
      <div class="lesson-main">
        <div class="lesson-progress-bar">
          <a href="#home" class="lesson-back-btn" aria-label="Back to lessons">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 3 L5 8 L10 13"/>
            </svg>
            All lessons
          </a>
          <div class="lesson-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100">
            <div class="lesson-progress-fill"></div>
          </div>
          <span class="lesson-section-counter"></span>
        </div>

        <div class="lesson-content">
          <div class="lesson-header">
            <div class="lesson-meta">
              <span class="lesson-id-badge">${escapeHtml(lesson.id)}</span>
              <span class="lesson-time-badge">~ ${lesson.estimatedMinutes ?? 20} min</span>
            </div>
            <h1>${escapeHtml(lesson.title)}</h1>
            <p class="lesson-description">${escapeHtml(lesson.description)}</p>
          </div>
          <!-- section-wrapper and section-nav inserted dynamically -->
        </div>
      </div>
    </div>
  `;
}

function buildSectionNav(idx, total, isLast) {
  return `
    <div class="section-nav">
      ${idx > 0
        ? `<button class="btn btn-secondary nav-prev">← Previous</button>`
        : `<span></span>`}
      <button class="btn btn-primary nav-next">
        ${isLast ? 'Finish lesson ✓' : 'Next →'}
      </button>
    </div>
  `;
}

function showCompleteBanner(contentEl, lesson) {
  const wrapper = contentEl.querySelector('.section-wrapper');
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="lesson-complete-banner">
      <h3>Lesson complete!</h3>
      <p>You finished "${escapeHtml(lesson.title)}".</p>
      <div class="btn-group">
        <a href="#home" class="btn btn-secondary">Back to all lessons</a>
        <a href="#stats" class="btn btn-primary">View my progress</a>
      </div>
    </div>
  `;
  // Remove nav
  contentEl.querySelector('.section-nav')?.remove();
}

// ─── Section renderers ───────────────────────────────────────────────────────

function renderSection(section, idx, total) {
  switch (section.type) {
    case 'text':       return renderTextSection(section);
    case 'code-demo':  return renderCodeDemoSection(section);
    case 'quiz':       return renderQuizSection(section);
    case 'exercise':   return renderExerciseSection(section);
    default:           return `<p style="color:var(--text-muted)">Unknown section type: ${section.type}</p>`;
  }
}

function renderTextSection(section) {
  // Support newline → paragraph splitting and inline `code`
  const html = formatTextContent(section.content);
  return `
    <div class="section-text">
      ${html}
      <div class="section-nav-placeholder"></div>
    </div>
    ${buildSectionNavPlaceholder()}
  `;
}

function renderCodeDemoSection(section) {
  return `
    <div class="section-code-demo">
      <div class="code-demo-label">${t('exampleLabel')}</div>
      <div class="code-block">
        <div class="code-block-header">
          <span class="code-lang-tag">${escapeHtml(section.language ?? 'python')}</span>
          <button class="code-copy-btn" data-copy="${escapeAttr(section.code)}">Copy</button>
        </div>
        <pre><code>${highlightPython(escapeHtml(section.code))}</code></pre>
      </div>
      ${section.explanation ? `<div class="code-explanation">${escapeHtml(section.explanation)}</div>` : ''}
    </div>
    ${buildSectionNavPlaceholder()}
  `;
}

function renderQuizSection(section) {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const optionsHtml = section.options.map((opt, i) => `
    <button class="quiz-option" data-index="${i}" aria-label="Option ${letters[i]}: ${escapeHtml(opt)}">
      <span class="quiz-option-letter">${letters[i]}</span>
      <span>${escapeHtml(opt)}</span>
    </button>
  `).join('');

  // If question contains a code snippet (lines starting with spaces or 'for/if/while/def')
  const parts  = section.question.split('\n');
  const prose  = parts[0];
  const codeLines = parts.slice(1).join('\n').trim();

  return `
    <div class="section-quiz" data-correct="${section.correct}">
      <div class="quiz-label">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="7"/></svg>
        ${t('quizLabel')}
      </div>
      <p class="quiz-question">
        ${escapeHtml(prose)}
        ${codeLines ? `<code>${highlightPython(escapeHtml(codeLines))}</code>` : ''}
      </p>
      <div class="quiz-options">${optionsHtml}</div>
      <div class="quiz-feedback" role="alert"></div>
    </div>
    ${buildSectionNavPlaceholder()}
  `;
}

function renderExerciseSection(section) {
  const starter = section.starterCode ?? '';
  return `
    <div class="section-exercise">
      <div class="exercise-label">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="2" y="2" width="10" height="10" rx="1"/>
          <path d="M5 7 L7 9 L9 5"/>
        </svg>
        ${t('exerciseLabel')}
      </div>
      <p class="exercise-prompt">${escapeHtml(section.prompt)}</p>
      <div class="exercise-editor-wrap">
        <div class="exercise-toolbar">
          <button class="btn btn-primary btn-sm exercise-run">${t('run')}</button>
          <button class="btn btn-secondary btn-sm exercise-reset">${t('reset')}</button>
          ${section.hint ? `<button class="btn btn-ghost btn-sm exercise-hint-btn">${t('showHint')}</button>` : ''}
          <span class="run-hint" aria-hidden="true">Ctrl+Enter to run</span>
          <div class="pyodide-loader" aria-live="polite">
            <div class="pyodide-progress"><div class="pyodide-progress-fill"></div></div>
            <span class="pyodide-load-text">${t('loadingPython')}</span>
          </div>
        </div>
        <!-- .exercise-host: CM6 attaches here; hidden textarea is the fallback -->
        <div class="exercise-host" data-starter="${escapeAttr(starter)}">
          <textarea class="exercise-textarea" spellcheck="false" aria-label="Code editor">${escapeHtml(starter)}</textarea>
        </div>
        <div class="exercise-output" role="log" aria-live="polite" aria-label="Output"></div>
      </div>
      ${section.hint ? `
        <div class="hint-section">
          <div class="hint-text" role="note">${escapeHtml(section.hint)}</div>
        </div>` : ''}
      ${section.solution ? `
        <div class="solution-section">
          <button class="btn btn-ghost btn-sm exercise-solution-btn">${t('showSolution')}</button>
          <div class="solution-text">
            <strong>Solution:</strong>
            <pre><code>${highlightPython(escapeHtml(section.solution))}</code></pre>
          </div>
        </div>` : ''}
    </div>
    ${buildSectionNavPlaceholder()}
  `;
}

function buildSectionNavPlaceholder() {
  // Actual content is inserted by showSection() so the nav is always at the bottom
  return `<div class="section-nav"></div>`;
}

// ─── Section event binding ───────────────────────────────────────────────────

function bindSectionEvents(wrapper, section, lessonId, onQuizAttempt, onQuizResult) {
  // Copy buttons
  wrapper.querySelectorAll('.code-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '').catch(() => {});
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
    });
  });

  // Quiz options
  if (section.type === 'quiz') {
    const quizEl    = wrapper.querySelector('.section-quiz');
    const feedback  = quizEl?.querySelector('.quiz-feedback');
    const correct   = parseInt(quizEl?.dataset.correct ?? '-1', 10);
    let answered    = false;

    quizEl?.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        onQuizAttempt();

        const chosen   = parseInt(btn.dataset.index, 10);
        const isRight  = chosen === correct;
        onQuizResult(isRight);

        quizEl.querySelectorAll('.quiz-option').forEach((b, i) => {
          b.disabled = true;
          if (i === correct) b.classList.add('correct');
          else if (i === chosen && !isRight) b.classList.add('wrong');
        });

        if (feedback) {
          feedback.textContent = isRight
            ? `✓ Correct! ${section.explanation ?? ''}`
            : `✗ Not quite. ${section.explanation ?? ''}`;
          feedback.className = `quiz-feedback show ${isRight ? 'success' : 'error'}`;
        }
      });
    });
  }

  // Exercise: hint reveal
  const hintBtn  = wrapper.querySelector('.exercise-hint-btn');
  const hintText = wrapper.querySelector('.hint-text');
  if (hintBtn && hintText) {
    hintBtn.addEventListener('click', () => {
      hintText.classList.toggle('show');
      hintBtn.textContent = hintText.classList.contains('show') ? t('hideHint') : t('showHint');
    });
  }

  // Exercise: solution reveal (after 3 attempts)
  let attempts = 0;
  const solutionBtn  = wrapper.querySelector('.exercise-solution-btn');
  const solutionText = wrapper.querySelector('.solution-text');
  if (solutionBtn && solutionText) {
    solutionBtn.style.display = 'none'; // hidden until 3 attempts
    solutionBtn.addEventListener('click', () => {
      solutionText.classList.toggle('show');
      solutionBtn.textContent = solutionText.classList.contains('show') ? t('hideSolution') : t('showSolution');
    });
  }

  // Exercise: reset
  const resetBtn = wrapper.querySelector('.exercise-reset');
  const hostEl   = wrapper.querySelector('.exercise-host');
  const textarea = wrapper.querySelector('.exercise-textarea');
  if (resetBtn) {
    const starter = section.starterCode ?? '';
    resetBtn.addEventListener('click', () => {
      // Reset CM6 if available (editor.js sets _editorView on the host element)
      if (hostEl?._editorView && window.CMEditor) {
        window.CMEditor.setEditorContent(hostEl._editorView, starter);
      } else if (textarea) {
        textarea.value = starter;
      }
    });
  }

  // Exercise: run — uses Pyodide sandbox via window._runPythonCode (set by editor.js)
  const runBtn  = wrapper.querySelector('.exercise-run');
  const outputEl = wrapper.querySelector('.exercise-output');
  if (runBtn && outputEl) {
    // Disable the run button until Pyodide is ready so the user gets clear feedback
    // instead of a button that appears to hang after clicking.
    function _setPyodideLoadingState(state) {
      if (state === 'ready') {
        runBtn.disabled = false;
        runBtn.textContent = t('run');
      } else if (state === 'loading' || state === 'idle') {
        runBtn.disabled = true;
        runBtn.textContent = t('runLoading');
      }
    }

    const currentState = window._pyodideState?.value ?? 'idle';
    if (currentState !== 'ready') {
      _setPyodideLoadingState(currentState);
      const unsub = window._onPyodideStateChange?.((state) => {
        _setPyodideLoadingState(state);
        if (state === 'ready' || state === 'error') unsub();
      });
    }

    async function runCode() {
      const pyState = window._pyodideState?.value;

      // Guard: if Python isn't ready yet, show a message and bail out.
      if (pyState !== 'ready') {
        outputEl.className = 'exercise-output';
        outputEl.innerHTML = pyState === 'loading'
          ? `<span style="color:var(--accent)">⏳ Python is still loading — wait a moment then try again.</span>`
          : `<span class="output-error">Python runtime not available.</span>\n` +
            `<span style="color:var(--text-faint);font-size:12px">Connect to the internet once to download it (~10 MB), then it works offline.</span>`;
        return;
      }

      recordExerciseAttempt(lessonId);
      attempts++;

      // Unlock solution button after 3 attempts
      if (solutionBtn && attempts >= 3) solutionBtn.style.display = '';

      // Read code from CM6 or fallback textarea
      const code = (hostEl?._editorView && window.CMEditor)
        ? window.CMEditor.getEditorContent(hostEl._editorView)
        : (textarea?.value ?? '');

      if (!code.trim()) return;

      outputEl.textContent = '';
      outputEl.className   = 'exercise-output';
      runBtn.disabled = true;
      runBtn.textContent = t('running');

      const result = await window._runPythonCode(code);

      runBtn.disabled = false;
      runBtn.textContent = t('run');

      if (result.error) {
        outputEl.textContent = result.error;
        outputEl.classList.add('output-error');
      } else {
        const out = [result.stdout, result.stderr ? '⚠ stderr:\n' + result.stderr : ''].filter(Boolean).join('\n');
        outputEl.textContent = out || t('noOutput');
        if (result.stderr) outputEl.classList.add('output-warning');
      }
    }

    runBtn.addEventListener('click', runCode);
  }
}

// ─── Simple Python syntax highlighter ───────────────────────────────────────
// No external library — just regex-based coloring for the most common tokens.

const PY_KEYWORDS = new Set([
  'False','None','True','and','as','assert','async','await','break',
  'class','continue','def','del','elif','else','except','finally',
  'for','from','global','if','import','in','is','lambda','nonlocal',
  'not','or','pass','raise','return','try','while','with','yield',
]);

const PY_BUILTINS = new Set([
  'print','input','len','range','int','float','str','bool','list',
  'dict','tuple','set','type','isinstance','enumerate','zip','map',
  'filter','sorted','reversed','min','max','sum','abs','round',
  'open','format','repr','hasattr','getattr','setattr',
]);

export function highlightPython(escapedCode) {
  // Input is already HTML-escaped — we wrap spans around tokens.
  // Keywords/builtins MUST run first: later passes add <span class="..."> tags
  // whose attribute text (e.g. the word "class") would otherwise be re-matched.
  return escapedCode
    // Keywords and builtins — before any HTML tags are inserted
    .replace(/\b([A-Za-z_]\w*)\b/g, (match) => {
      if (PY_KEYWORDS.has(match)) return `<span class="py-keyword">${match}</span>`;
      if (PY_BUILTINS.has(match)) return `<span class="py-builtin">${match}</span>`;
      return match;
    })
    // Strings (single + double, already escaped)
    .replace(/(&quot;(?:[^&]|&amp;|&lt;|&gt;)*?&quot;|&#39;(?:[^&]|&amp;|&lt;|&gt;)*?&#39;)/g,
             '<span class="py-string">$1</span>')
    // Comments
    .replace(/(#[^\n]*)/g, '<span class="py-comment">$1</span>')
    // Numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="py-number">$1</span>');
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

/**
 * Convert plain text into paragraph HTML.
 * Lines starting with 4 spaces become inline code blocks.
 */
function formatTextContent(text) {
  return text
    .split('\n\n')
    .map((para) => {
      if (para.startsWith('    ')) {
        const code = escapeHtml(para.replace(/^ {4}/gm, ''));
        return `<pre class="section-code-block"><code>${highlightPython(code)}</code></pre>`;
      }
      // Inline code with backticks
      const withCode = escapeHtml(para).replace(/`([^`]+)`/g, '<code>$1</code>');
      return `<p>${withCode}</p>`;
    })
    .join('\n');
}
