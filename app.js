// Phusion Passenger entry point — starts compiled NestJS API.
// cPanel's Passenger process may not inherit Node Selector's module path.
const fs = require('fs');
const path = require('path');
const Module = require('module');

process.chdir(__dirname);
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const nodevenvLib = process.env.NODEVENV_LIB_DIR
  || '/home/espartanoscl/nodevenv/repositories/spartanoshub/22/lib/node_modules';

if (fs.existsSync(nodevenvLib)) {
  process.env.NODE_PATH = [nodevenvLib, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter);
  Module._initPaths();

  // Passenger wraps CommonJS loading and can bypass NODE_PATH for modules
  // loaded below the entry point. Add the managed Node Selector directory to
  // every subsequently created module lookup path as an explicit fallback.
  const originalNodeModulePaths = Module._nodeModulePaths;
  Module._nodeModulePaths = function nodeModulePathsWithNodevenv(from) {
    const paths = originalNodeModulePaths.call(this, from);
    return paths.includes(nodevenvLib) ? paths : [nodevenvLib, ...paths];
  };
}

require(path.join(__dirname, 'apps', 'api', 'dist', 'main'));
