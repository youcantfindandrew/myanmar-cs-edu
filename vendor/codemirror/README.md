# CodeMirror 6 — vendor bundle

This directory will hold the self-hosted CodeMirror 6 bundle in Phase 2.

## Why self-hosted?

The app must work with zero internet connection. CDN links break offline.
Bundling CodeMirror locally ensures the editor works on a USB drive in
a classroom with no Wi-Fi.

## How to build the bundle (Phase 2)

```bash
# Requires Node.js (dev-time only — not shipped)
npm install @codemirror/state @codemirror/view @codemirror/commands \
            @codemirror/language @codemirror/lang-python \
            @codemirror/theme-one-dark

# Bundle with esbuild or rollup
npx esbuild src/codemirror-bundle.js --bundle --minify \
  --outfile=vendor/codemirror/codemirror.min.js
```

The resulting `codemirror.min.js` (~250 KB gzipped) is imported by `js/editor.js`.

## Current status

Phase 1 uses a plain `<textarea>` with tab-indent and auto-resize.
Full CodeMirror integration is Phase 2.
