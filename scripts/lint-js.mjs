#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

function walkJs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules') continue;
      walkJs(full, files);
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const files = walkJs(join(ROOT, 'js')).concat(walkJs(join(ROOT, 'domain')));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax error: ${relative(ROOT, file)}`);
    if (result.stderr) console.error(result.stderr.trim());
  }
}

if (failed) process.exit(1);
console.log(`Lint OK (${files.length} files)`);
