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
}

require(path.join(__dirname, 'apps', 'api', 'dist', 'main'));
