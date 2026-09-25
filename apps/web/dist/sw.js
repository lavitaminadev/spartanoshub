/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-3d8c9f1b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "d468a62d27d59d6f941c54325340a351"
  }, {
    "url": "manifest.webmanifest",
    "revision": "5e4ebab5a95e7df65224bbb2f0fb66e7"
  }, {
    "url": "assets/index-DlRglnBn.css",
    "revision": null
  }, {
    "url": "assets/index-BBU3q_vl.js",
    "revision": null
  }, {
    "url": "assets/vendor-router-Bv15XmU7.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-DH7OuyYy.js",
    "revision": null
  }, {
    "url": "assets/vendor-query-DMNMRM9C.js",
    "revision": null
  }, {
    "url": "assets/vendor-DaIpB-YE.js",
    "revision": null
  }, {
    "url": "assets/vendor-charts-60Qpwsxu.js",
    "revision": null
  }, {
    "url": "icons.svg",
    "revision": "21c7473c592c67dc87223d49892c8f0a"
  }, {
    "url": "icon-maskable-512x512.png",
    "revision": "7495b212240840919d7451f41c4fddc5"
  }, {
    "url": "icon-512x512.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "icon-512x512.png",
    "revision": "8c14127ca012017d46f1fad0af42f00f"
  }, {
    "url": "icon-192x192.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "icon-192x192.png",
    "revision": "652ab61ee15e90fbf7a6ea36c02f64ea"
  }, {
    "url": "favicon.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "favicon.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "icon-192x192.png",
    "revision": "652ab61ee15e90fbf7a6ea36c02f64ea"
  }, {
    "url": "icon-512x512.png",
    "revision": "8c14127ca012017d46f1fad0af42f00f"
  }, {
    "url": "icon-maskable-512x512.png",
    "revision": "7495b212240840919d7451f41c4fddc5"
  }, {
    "url": "brand/espartanos-helmet.png",
    "revision": "7bed0769879c8e63b47f18617de113a6"
  }, {
    "url": "brand/plus-jakarta-sans.woff2",
    "revision": "9ec41efe26fa9c21954fcc9b4c83dfba"
  }, {
    "url": "screenshots/pwa-mobile.png",
    "revision": "ee143eab199cd9255e357687649aa4e6"
  }, {
    "url": "screenshots/pwa-wide.png",
    "revision": "cc7a9d687746c68055683a3353b58a47"
  }, {
    "url": "manifest.webmanifest",
    "revision": "5e4ebab5a95e7df65224bbb2f0fb66e7"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(({
    request
  }) => request.mode === "navigate", new workbox.NetworkFirst({
    "cacheName": "espartanos-navigation",
    "networkTimeoutSeconds": 4,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 86400
    }), new workbox.CacheableResponsePlugin({
      statuses: [200]
    })]
  }), 'GET');

}));
