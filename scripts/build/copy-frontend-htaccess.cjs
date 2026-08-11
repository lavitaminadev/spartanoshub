#!/usr/bin/env node

const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const source = path.join(repositoryRoot, 'apps', 'web', 'public', '.htaccess');
const destinationDirectory = path.join(repositoryRoot, 'apps', 'web', 'dist');
const destination = path.join(destinationDirectory, '.htaccess');

if (!existsSync(source)) {
  throw new Error(`Missing frontend Apache configuration: ${source}`);
}

mkdirSync(destinationDirectory, { recursive: true });
copyFileSync(source, destination);

if (!existsSync(destination)) {
  throw new Error(`Could not create frontend Apache configuration: ${destination}`);
}

console.log('Frontend .htaccess copied to apps/web/dist/.htaccess');
