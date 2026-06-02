/**
 * db.js — IndexedDB wrapper
 *
 * Thin async API over IndexedDB. All public methods return Promises.
 * Object stores: students | progress | tutor_history
 */

const DB_NAME    = 'myanmar-cs-edu';
const DB_VERSION = 1;

let _db = null;

// ─── Open / migrate ──────────────────────────────────────────────────────────

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('students')) {
        db.createObjectStore('students', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('progress')) {
        const store = db.createObjectStore('progress', {
          keyPath: ['lessonId', 'studentId'],
        });
        store.createIndex('by_student', 'studentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('tutor_history')) {
        db.createObjectStore('tutor_history', {
          keyPath: ['lessonId', 'studentId'],
        });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = ()  => reject(req.error);
  });
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function tx(storeName, mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  });
}

function get(storeName, key) {
  return tx(storeName, 'readonly', (s) => s.get(key));
}

function put(storeName, value) {
  return tx(storeName, 'readwrite', (s) => s.put(value));
}

function getAll(storeName) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, 'readonly');
      const req = t.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  });
}

// ─── Students ────────────────────────────────────────────────────────────────

const STUDENT_KEY = 'local-student';

/** Returns the current student, creating one on first call. */
export async function getStudent() {
  let student = await get('students', STUDENT_KEY);
  if (!student) {
    student = {
      id:          STUDENT_KEY,
      name:        '',
      deviceLabel: '',
      createdAt:   new Date().toISOString(),
    };
    await put('students', student);
  }
  return student;
}

export async function setStudentName(name) {
  const student = await getStudent();
  student.name = name.trim();
  return put('students', student);
}

export async function setDeviceLabel(label) {
  const student = await getStudent();
  student.deviceLabel = label.trim();
  return put('students', student);
}

// ─── Progress ────────────────────────────────────────────────────────────────

const STATUSES = /** @type {const} */ (['not-started', 'in-progress', 'completed']);

/** Returns the progress record for one lesson. Creates a default if absent. */
export async function getProgress(lessonId) {
  const student = await getStudent();
  const record  = await get('progress', [lessonId, student.id]);
  return record ?? {
    lessonId,
    studentId:        student.id,
    status:           'not-started',
    quizScore:        0,
    quizTotal:        0,
    timeSpentSeconds: 0,
    completedAt:      null,
    exerciseAttempts: 0,
    lastSectionIndex: 0,
  };
}

/**
 * Upsert progress for a lesson.
 * @param {string} lessonId
 * @param {Partial<ReturnType<typeof getProgress>>} updates
 */
export async function setProgress(lessonId, updates) {
  const current = await getProgress(lessonId);
  const merged  = { ...current, ...updates };

  // Auto-set completedAt when status changes to completed
  if (merged.status === 'completed' && !merged.completedAt) {
    merged.completedAt = new Date().toISOString();
  }

  return put('progress', merged);
}

/** Returns progress records for all lessons. */
export async function getAllProgress() {
  const student = await getStudent();
  const all     = await getAll('progress');
  return all.filter((r) => r.studentId === student.id);
}

// ─── Tutor history ───────────────────────────────────────────────────────────

export async function getTutorHistory(lessonId) {
  const student = await getStudent();
  const record  = await get('tutor_history', [lessonId, student.id]);
  return record?.messages ?? [];
}

export async function appendTutorMessage(lessonId, msg) {
  const student  = await getStudent();
  const messages = await getTutorHistory(lessonId);
  messages.push({ ...msg, timestamp: new Date().toISOString() });
  return put('tutor_history', {
    lessonId,
    studentId: student.id,
    messages,
  });
}

export async function clearTutorHistory(lessonId) {
  const student = await getStudent();
  return put('tutor_history', { lessonId, studentId: student.id, messages: [] });
}

// ─── CSV export ──────────────────────────────────────────────────────────────

/**
 * Returns a CSV string of all progress records for the current student.
 * Teachers copy this file from each device for offline aggregation.
 */
export async function exportAllAsCSV() {
  const student  = await getStudent();
  const records  = await getAllProgress();

  const header = [
    'student_name', 'device_label', 'lesson_id', 'status',
    'quiz_score', 'quiz_total', 'time_spent_seconds',
    'exercise_attempts', 'completed_at', 'exported_at',
  ].join(',');

  const now = new Date().toISOString();

  const rows = records.map((r) => [
    `"${(student.name        || '').replace(/"/g, '""')}"`,
    `"${(student.deviceLabel || '').replace(/"/g, '""')}"`,
    r.lessonId,
    r.status,
    r.quizScore,
    r.quizTotal,
    r.timeSpentSeconds,
    r.exerciseAttempts,
    r.completedAt ?? '',
    now,
  ].join(','));

  return [header, ...rows].join('\n');
}
