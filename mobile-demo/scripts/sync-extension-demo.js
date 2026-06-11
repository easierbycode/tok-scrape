#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(MOBILE_ROOT, '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'extension-creator-demo');
const TARGET_ROOT = path.join(MOBILE_ROOT, 'www', 'ext');

const FILES = ['lifepreneur.js', 'template.js', 'demo.js'];

function copyFile(name) {
  const source = path.join(SOURCE_ROOT, name);
  const target = path.join(TARGET_ROOT, name);
  fs.copyFileSync(source, target);
  console.log(`sync-extension-demo: ${path.relative(REPO_ROOT, source)} -> ${path.relative(REPO_ROOT, target)}`);
}

fs.mkdirSync(TARGET_ROOT, { recursive: true });
FILES.forEach(copyFile);
