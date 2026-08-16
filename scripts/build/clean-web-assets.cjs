const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const webDist = path.join(repoRoot, 'apps', 'web', 'dist');
const assetsDir = path.join(webDist, 'assets');
const resolvedAssetsDir = path.resolve(assetsDir);
const expectedPrefix = `${path.resolve(webDist)}${path.sep}`;

if (!resolvedAssetsDir.startsWith(expectedPrefix)) {
  throw new Error(`Refusing to clean unexpected path: ${resolvedAssetsDir}`);
}

if (fs.existsSync(resolvedAssetsDir)) {
  fs.rmSync(resolvedAssetsDir, { recursive: true, force: true });
}

fs.mkdirSync(resolvedAssetsDir, { recursive: true });
console.log('Cleaned apps/web/dist/assets before compiling');
