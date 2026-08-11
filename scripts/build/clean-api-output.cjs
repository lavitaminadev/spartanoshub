#!/usr/bin/env node

const { rmSync } = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const apiRoot = path.join(repositoryRoot, 'apps', 'api');
const outputDirectory = path.join(apiRoot, 'dist');

if (path.dirname(outputDirectory) !== apiRoot || path.basename(outputDirectory) !== 'dist') {
  throw new Error(`Refusing to clean an unexpected API output path: ${outputDirectory}`);
}

rmSync(outputDirectory, { recursive: true, force: true });
console.log('Cleaned apps/api/dist before compiling');
