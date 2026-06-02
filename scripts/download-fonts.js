#!/usr/bin/env node
/**
 * download-fonts.js — Download IBM Plex Sans + Mono woff2 files
 *
 * Run once:  node scripts/download-fonts.js
 *
 * Sources from the official IBM/plex npm package via jsDelivr.
 * Files are placed in assets/fonts/ (not committed to git if large).
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
fs.mkdirSync(OUT_DIR, { recursive: true });

// jsDelivr serves individual files from npm — use the correct package paths
const BASE      = 'https://cdn.jsdelivr.net/npm/@ibm/plex@6.4.0/IBM-Plex-Sans/fonts/complete/woff2/';
const BASE_MONO = 'https://cdn.jsdelivr.net/npm/@ibm/plex@6.4.0/IBM-Plex-Mono/fonts/complete/woff2/';
// Note: if CDN returns 403, run from a browser or use `npm install @ibm/plex`
// and copy from node_modules/@ibm/plex/.../woff2/ as documented in scripts/generate-icons.js

const FILES = [
  { url: BASE      + 'IBMPlexSans-Regular.woff2',  out: 'IBMPlexSans-Regular.woff2'  },
  { url: BASE      + 'IBMPlexSans-Medium.woff2',   out: 'IBMPlexSans-Medium.woff2'   },
  { url: BASE      + 'IBMPlexSans-Bold.woff2',     out: 'IBMPlexSans-Bold.woff2'     },
  { url: BASE_MONO + 'IBMPlexMono-Regular.woff2',  out: 'IBMPlexMono-Regular.woff2'  },
  { url: BASE_MONO + 'IBMPlexMono-Bold.woff2',     out: 'IBMPlexMono-Bold.woff2'     },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ already exists: ${path.basename(dest)}`);
      resolve();
      return;
    }
    const file = fs.createWriteStream(dest);
    const get  = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
  });
}

(async () => {
  console.log('Downloading IBM Plex fonts…\n');
  for (const { url, out } of FILES) {
    const dest = path.join(OUT_DIR, out);
    process.stdout.write(`  ↓ ${out}… `);
    try {
      await download(url, dest);
      console.log('done');
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    }
  }
  console.log('\nFonts saved to assets/fonts/');
})();
