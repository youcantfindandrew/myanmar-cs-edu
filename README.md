# Code Myanmar

**An offline-first CS education platform for students in Myanmar.**

13 Python lessons — from zero to writing real programs. Runs on a USB drive in a classroom with no internet. No server, no accounts, no cloud.

---

## Quick start

```bash
cd myanmar-cs-edu
python3 -m http.server 8080
# Open http://localhost:8080
```

On Windows, double-click `START.bat`.

## What this is

Most coding platforms assume broadband, a modern laptop, and a Google account. This one assumes none of that.

It runs fully offline. Progress saves locally to IndexedDB. Teachers collect a CSV export per device and aggregate it themselves. An AI tutor (Phi-3 mini via WebLLM) runs entirely in the browser after a one-time ~2 GB download — no API key, no server.

## Tech

- Vanilla JS (ES Modules) — no build step, USB-safe
- Service Worker + Cache API — full offline support
- IndexedDB — local progress storage
- CodeMirror 6 (Phase 2) — self-hosted Python editor
- Pyodide (Phase 2) — real Python execution in WebAssembly
- WebLLM + Phi-3 mini (Phase 2) — in-browser AI tutor

## Curriculum

| # | Lesson | Time |
|---|--------|------|
| 1 | What Is Code? | 15 min |
| 2 | Variables | 20 min |
| 3 | Data Types | 20 min |
| 4 | Input & Output | 20 min |
| 5 | Conditionals | 25 min |
| 6 | Loops | 25 min |
| 7 | Functions | 25 min |
| 8 | Lists | 25 min |
| 9 | Debugging | 20 min |
| 10 | Mini Project — Calculator | 35 min |
| 11 | Strings | 25 min |
| 12 | Dictionaries | 25 min |
| 13 | Final Project — Grade Tracker | 45 min |

## USB deployment

```
USB/
  myanmar-cs-edu/     ← this repo
  model/              ← Phi-3 mini ONNX files (~2 GB, not in git)
  pyodide/            ← Pyodide WASM bundle (~10 MB, not in git)
  START.bat           ← Windows launcher
```

See `model/README.md` and `README-TEACHER.txt` for setup instructions.

## Development phases

- [x] **Phase 1** — Offline core: routing, IndexedDB, home screen, lesson viewer
- [ ] **Phase 2** — Content + editor: CodeMirror, Pyodide, WebLLM tutor
- [ ] **Phase 3** — Stats + polish: CSV export, animations, USB packaging
- [ ] **Phase 4** — Deploy to Myanmar classrooms
- [ ] **Phase 5** — Document + publicise

---

*Built by Andrew Lwin — teaching kids to code in Myanmar since 2023.*
