#!/usr/bin/env node
/**
 * generate-icons.js — Generate PWA PNG icons from the SVG master
 *
 * Run:  node scripts/generate-icons.js
 *
 * Requires: npm install --save-dev sharp  (already in devDependencies if this was run)
 * Falls back to writing placeholder PNGs if sharp isn't available.
 */

const fs   = require('fs');
const path = require('path');

const SVG_SRC  = path.join(__dirname, '..', 'assets', 'icons', 'icon.svg');
const OUT_DIR  = path.join(__dirname, '..', 'assets', 'icons');
const SIZES    = [192, 512];

async function generateWithSharp() {
  const sharp = require('sharp');
  const svg   = fs.readFileSync(SVG_SRC);

  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(out);
    console.log(`  ✓ icon-${size}.png`);
  }
}

async function generateFallback() {
  // Write a minimal valid 1x1 PNG as placeholder
  // (Base64 encoded 1x1 transparent PNG)
  const tiny1px = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  for (const size of SIZES) {
    const out = path.join(OUT_DIR, `icon-${size}.png`);
    if (!fs.existsSync(out)) {
      fs.writeFileSync(out, tiny1px);
      console.log(`  ⚠ icon-${size}.png (placeholder — install sharp for real icons)`);
    } else {
      console.log(`  ✓ icon-${size}.png (already exists)`);
    }
  }
}

(async () => {
  console.log('Generating PWA icons…\n');
  try {
    await generateWithSharp();
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('  sharp not installed. Using placeholder PNGs.');
      console.log('  For real icons: npm install --save-dev sharp && node scripts/generate-icons.js\n');
      await generateFallback();
    } else {
      console.error('Error:', err.message);
      await generateFallback();
    }
  }
  console.log('\nDone. Icons in assets/icons/');
})();
