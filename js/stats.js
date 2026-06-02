/**
 * stats.js — Stats page + CSV export
 */

import { getStudent, exportAllAsCSV } from './db.js';
import { getOverallStats, formatTime } from './progress.js';
import { loadLessonIndex, escapeHtml } from './lessons.js';

export async function renderStats(container) {
  const [index, student] = await Promise.all([
    loadLessonIndex(),
    getStudent(),
  ]);
  const stats = await getOverallStats(index.length);

  container.innerHTML = `
    <div class="page-header">
      <h1>My Progress</h1>
      <p>${student.name ? `Good work, ${escapeHtml(student.name)}!` : 'Keep going — every lesson counts.'}</p>
    </div>

    <div class="stats-grid">${buildStatsGrid(stats)}</div>

    <div class="stats-section-header">
      <h2>Lesson breakdown</h2>
      <button class="btn btn-secondary btn-sm" id="export-csv-btn">
        ↓ Export CSV
      </button>
    </div>

    <div class="lessons-breakdown" id="lessons-breakdown">
      ${await buildLessonBreakdown(index)}
    </div>
  `;

  injectStatsStyles();

  container.querySelector('#export-csv-btn')?.addEventListener('click', async () => {
    const csv  = await exportAllAsCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `progress-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function buildStatsGrid(stats) {
  const completionPct = stats.totalLessons > 0
    ? Math.round((stats.completed / stats.totalLessons) * 100)
    : 0;

  const cards = [
    {
      value: `${stats.completed} / ${stats.totalLessons}`,
      label: 'Lessons completed',
      sub:   `${completionPct}% done`,
      icon:  '✓',
      color: 'var(--success)',
    },
    {
      value: formatTime(stats.totalTime),
      label: 'Time learning',
      sub:   'Keep it up!',
      icon:  '⏱',
      color: 'var(--accent)',
    },
    {
      value: stats.quizAccuracy !== null ? `${stats.quizAccuracy}%` : '—',
      label: 'Quiz accuracy',
      sub:   stats.quizAnswered > 0
               ? `${stats.quizCorrect} / ${stats.quizAnswered} correct`
               : 'No quizzes yet',
      icon:  '◎',
      color: 'var(--text-primary)',
    },
    {
      value: stats.streak > 0 ? `${stats.streak}d` : '—',
      label: 'Day streak',
      sub:   stats.streak > 0 ? 'Consecutive days active' : 'Start your streak today!',
      icon:  '🔥',
      color: 'var(--warning)',
    },
  ];

  return cards.map((c) => `
    <div class="stats-card">
      <div class="stats-card-value" style="color:${c.color}">${escapeHtml(String(c.value))}</div>
      <div class="stats-card-label">${escapeHtml(c.label)}</div>
      <div class="stats-card-sub">${escapeHtml(c.sub)}</div>
    </div>
  `).join('');
}

async function buildLessonBreakdown(index) {
  const { getAllProgress } = await import('./db.js');
  const allProgress = await getAllProgress();
  const progressMap = new Map(allProgress.map((p) => [p.lessonId, p]));

  return index.map((lesson) => {
    const p = progressMap.get(lesson.id);
    const status = p?.status ?? 'not-started';

    return `
      <div class="breakdown-row">
        <span class="breakdown-lesson-num">${String(lesson.order ?? '').padStart(2, '0')}</span>
        <a href="#lesson/${lesson.id}" class="breakdown-lesson-title">${escapeHtml(lesson.title)}</a>
        <span class="breakdown-status badge--${status} lesson-status-badge">
          ${status === 'completed' ? '✓ Done' : status === 'in-progress' ? '…' : '—'}
        </span>
        <span class="breakdown-quiz">
          ${p?.quizTotal > 0 ? `${p.quizScore}/${p.quizTotal}` : '—'}
        </span>
        <span class="breakdown-time">
          ${p?.timeSpentSeconds > 0 ? formatTime(p.timeSpentSeconds) : '—'}
        </span>
      </div>
    `;
  }).join('');
}

// ─── Stats page styles (injected once) ───────────────────────────────────────

let _stylesInjected = false;
function injectStatsStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .stats-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .stats-card-value {
      font-family: var(--font-mono);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 6px;
    }
    .stats-card-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .stats-card-sub {
      font-size: 12px;
      color: var(--text-faint);
    }

    .stats-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .stats-section-header h2 {
      font-family: var(--font-mono);
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .lessons-breakdown {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .breakdown-row {
      display: grid;
      grid-template-columns: 32px 1fr 80px 60px 60px;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    .breakdown-row:last-child { border-bottom: none; }
    .breakdown-row:hover { background: var(--surface); }
    .breakdown-lesson-num {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-faint);
    }
    .breakdown-lesson-title {
      color: var(--text-primary);
      font-weight: 500;
    }
    .breakdown-lesson-title:hover { color: var(--accent); }
    .breakdown-status { font-size: 11px; text-align: center; }
    .breakdown-quiz, .breakdown-time {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-muted);
      text-align: right;
    }

    @media (max-width: 500px) {
      .breakdown-row { grid-template-columns: 1fr auto; }
      .breakdown-lesson-num, .breakdown-quiz, .breakdown-time { display: none; }
    }
  `;
  document.head.appendChild(style);
}
