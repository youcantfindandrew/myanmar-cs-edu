/**
 * progress.js — Progress logic
 *
 * Higher-level helpers built on db.js:
 * streaks, overall stats, mark-complete utilities.
 */

import { getAllProgress, setProgress, getProgress } from './db.js';

/** Mark a lesson as started (only if not yet in-progress or completed). */
export async function markLessonStarted(lessonId) {
  const p = await getProgress(lessonId);
  if (p.status === 'not-started') {
    await setProgress(lessonId, { status: 'in-progress' });
  }
}

/** Mark a lesson as completed and record the final quiz score. */
export async function markLessonCompleted(lessonId, quizScore, quizTotal) {
  await setProgress(lessonId, {
    status: 'completed',
    quizScore,
    quizTotal,
  });
}

/** Record a quiz answer. Returns the updated progress record. */
export async function recordQuizAnswer(lessonId, isCorrect) {
  const p = await getProgress(lessonId);
  return setProgress(lessonId, {
    quizScore: p.quizScore + (isCorrect ? 1 : 0),
    quizTotal: p.quizTotal + 1,
  });
}

/** Increment the exercise attempt counter. */
export async function recordExerciseAttempt(lessonId) {
  const p = await getProgress(lessonId);
  return setProgress(lessonId, {
    exerciseAttempts: (p.exerciseAttempts ?? 0) + 1,
    status: p.status === 'not-started' ? 'in-progress' : p.status,
  });
}

/** Add seconds to the time-spent counter for a lesson. */
export async function addTimeSpent(lessonId, seconds) {
  const p = await getProgress(lessonId);
  return setProgress(lessonId, {
    timeSpentSeconds: (p.timeSpentSeconds ?? 0) + seconds,
  });
}

/** Save the last section index so students can resume. */
export async function saveLastSection(lessonId, sectionIndex) {
  return setProgress(lessonId, { lastSectionIndex: sectionIndex });
}

// ─── Aggregate stats ─────────────────────────────────────────────────────────

/**
 * Returns overall stats for the stats page.
 * @param {number} totalLessons — total count from lessons/index.json
 */
export async function getOverallStats(totalLessons) {
  const records = await getAllProgress();

  const completed    = records.filter((r) => r.status === 'completed').length;
  const inProgress   = records.filter((r) => r.status === 'in-progress').length;
  const totalTime    = records.reduce((s, r) => s + (r.timeSpentSeconds ?? 0), 0);
  const quizAnswered = records.reduce((s, r) => s + (r.quizTotal ?? 0), 0);
  const quizCorrect  = records.reduce((s, r) => s + (r.quizScore ?? 0), 0);

  return {
    completed,
    inProgress,
    totalLessons,
    totalTime,
    quizAnswered,
    quizCorrect,
    quizAccuracy: quizAnswered > 0 ? Math.round((quizCorrect / quizAnswered) * 100) : null,
    streak: computeStreak(records),
  };
}

/** Compute consecutive days with any lesson activity. */
function computeStreak(records) {
  // Collect unique days where any lesson was touched
  const days = new Set();

  records.forEach((r) => {
    if (r.completedAt) days.add(r.completedAt.slice(0, 10));
  });

  if (days.size === 0) return 0;

  const sorted = [...days].sort().reverse(); // newest first
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of sorted) {
    const d = new Date(day);
    const diffDays = Math.round((cursor - d) / 86400000);
    if (diffDays <= 1) {
      streak++;
      cursor = d;
    } else {
      break;
    }
  }

  return streak;
}

/** Format seconds as "Xh Ym" or "Ym Zs". */
export function formatTime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
