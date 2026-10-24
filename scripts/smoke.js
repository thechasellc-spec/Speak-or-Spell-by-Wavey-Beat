#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'Speak-or-Spell-by-Wavey-Beat.-main/index.html',
  'Speak-or-Spell-by-Wavey-Beat.-main/renderer.js',
  'Speak-or-Spell-by-Wavey-Beat.-main/singer-core.js',
  'Speak-or-Spell-by-Wavey-Beat.-main/package.json'
];

let missing = [];
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) missing.push(file);
}

if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}

for (const file of files) {
  const full = path.join(root, file);
  try {
    if (file.endsWith('.js')) {
      require('vm').runInNewContext(fs.readFileSync(full, 'utf8'), { window: {}, console, setTimeout, clearTimeout });
    }
  } catch (error) {
    console.error(`Syntax check failed for ${file}: ${error.message}`);
    process.exit(1);
  }
}

console.log('Smoke checks passed.');
