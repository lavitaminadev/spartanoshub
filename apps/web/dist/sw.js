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
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "b58e6addc167b5bb568096253b1ad84f"
  }, {
    "url": "assets/WaitlistPage-DVCts8Dg.js",
    "revision": null
  }, {
    "url": "assets/vendor-router-bAXXhVKi.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-CR_D0olF.js",
    "revision": null
  }, {
    "url": "assets/vendor-query-D6ZBuABB.js",
    "revision": null
  }, {
    "url": "assets/vendor-DYQU0xHj.js",
    "revision": null
  }, {
    "url": "assets/vendor-charts-AeIbCRHT.js",
    "revision": null
  }, {
    "url": "assets/UsersPage-DstLUwfX.js",
    "revision": null
  }, {
    "url": "assets/Tooltip-1hp72253.js",
    "revision": null
  }, {
    "url": "assets/StatusBadge-DyGt0jI4.js",
    "revision": null
  }, {
    "url": "assets/status-palette-C32xZ10X.js",
    "revision": null
  }, {
    "url": "assets/status-labels-DUO2UOn5.js",
    "revision": null
  }, {
    "url": "assets/SettingsPage-2GliTu4z.js",
    "revision": null
  }, {
    "url": "assets/SessionsPage-BPnVsiJP.js",
    "revision": null
  }, {
    "url": "assets/SecurityPage-BjLbse3r.js",
    "revision": null
  }, {
    "url": "assets/search-C-ELg2fg.js",
    "revision": null
  }, {
    "url": "assets/safe-url-BtujETPP.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-QTnfLwEv.js",
    "revision": null
  }, {
    "url": "assets/ResetPasswordPage-BaCR6aZ8.js",
    "revision": null
  }, {
    "url": "assets/ReservationsPage-CRWX_r4P.css",
    "revision": null
  }, {
    "url": "assets/ReservationsPage-BuCmh8-1.js",
    "revision": null
  }, {
    "url": "assets/ReservationsAnalyticsPage-DjqjXgum.js",
    "revision": null
  }, {
    "url": "assets/ReservationResults-DQFdLbpD.js",
    "revision": null
  }, {
    "url": "assets/ReservationBuilderPage-Dd-9yAgy.js",
    "revision": null
  }, {
    "url": "assets/ReportsPage-DBjysnLa.js",
    "revision": null
  }, {
    "url": "assets/QueryErrorState-hczQQ9z-.js",
    "revision": null
  }, {
    "url": "assets/PulsoEspartano-DOSyFMym.js",
    "revision": null
  }, {
    "url": "assets/PublicReservationPage-C5DhmJ59.css",
    "revision": null
  }, {
    "url": "assets/PublicReservationPage-C2otCw3L.js",
    "revision": null
  }, {
    "url": "assets/ProductionPage-YGULoxNn.js",
    "revision": null
  }, {
    "url": "assets/PasswordField-BtYpttMM.js",
    "revision": null
  }, {
    "url": "assets/PageHero-DW_sGVob.css",
    "revision": null
  }, {
    "url": "assets/PageHero-C-hYhcJQ.js",
    "revision": null
  }, {
    "url": "assets/OperationsPage-6zyunfmR.js",
    "revision": null
  }, {
    "url": "assets/OnboardingPage-DZDfuS_b.js",
    "revision": null
  }, {
    "url": "assets/OAuthCallbackPage-DDdb7sDc.js",
    "revision": null
  }, {
    "url": "assets/MonthlyReportCard-BN7rxxv_.js",
    "revision": null
  }, {
    "url": "assets/Modal-BjG34rfC.js",
    "revision": null
  }, {
    "url": "assets/MeetingsPage-DEpxtBPn.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-BfhtZTCD.js",
    "revision": null
  }, {
    "url": "assets/local-time-CDXSxa83.js",
    "revision": null
  }, {
    "url": "assets/LeadsPage-9SA0v27Y.js",
    "revision": null
  }, {
    "url": "assets/KnowledgePage-B-yENEBq.js",
    "revision": null
  }, {
    "url": "assets/IntegrationsPage-5O807uEt.js",
    "revision": null
  }, {
    "url": "assets/IntakePage-Cg0XLX3o.js",
    "revision": null
  }, {
    "url": "assets/index-lu3OpEKN.css",
    "revision": null
  }, {
    "url": "assets/index-DOOLqYpe.js",
    "revision": null
  }, {
    "url": "assets/ImageUpload-DOl3UumF.js",
    "revision": null
  }, {
    "url": "assets/GovernancePage-DCDeYLZN.js",
    "revision": null
  }, {
    "url": "assets/GamificationPage-Gd3NvdD8.js",
    "revision": null
  }, {
    "url": "assets/ForgotPasswordPage-qr1dFcsB.js",
    "revision": null
  }, {
    "url": "assets/ForbiddenState-Bxs4iLEj.js",
    "revision": null
  }, {
    "url": "assets/FirstAccessPage-CM8GorW-.js",
    "revision": null
  }, {
    "url": "assets/EmptyState-BGkp0LX0.js",
    "revision": null
  }, {
    "url": "assets/DocumentsPage-cQyX6Cid.js",
    "revision": null
  }, {
    "url": "assets/DirectionPage-lylqN7YT.js",
    "revision": null
  }, {
    "url": "assets/DataTable-DVgd8d9_.js",
    "revision": null
  }, {
    "url": "assets/DashboardPage-CAy-zKID.js",
    "revision": null
  }, {
    "url": "assets/CrmRecordsPage-BDGxTfFy.js",
    "revision": null
  }, {
    "url": "assets/ContractsPage-Ck696ghC.js",
    "revision": null
  }, {
    "url": "assets/ContentGridPage-D_HUcUyD.js",
    "revision": null
  }, {
    "url": "assets/ConfirmDialog-GobSfjF8.js",
    "revision": null
  }, {
    "url": "assets/CloudinaryConfigModal-CoSagkEP.js",
    "revision": null
  }, {
    "url": "assets/ClientsPage-tx4nVYGh.js",
    "revision": null
  }, {
    "url": "assets/ClientsPage-RuBfMJ7y.css",
    "revision": null
  }, {
    "url": "assets/ClientReports-B8PjHs82.js",
    "revision": null
  }, {
    "url": "assets/ClientMeetings-BlKUH-Tk.js",
    "revision": null
  }, {
    "url": "assets/ClientLayout-CkFwKu9A.js",
    "revision": null
  }, {
    "url": "assets/ClientGrid-DsXvUA2y.js",
    "revision": null
  }, {
    "url": "assets/ClientDetailPage-CcUhalAi.js",
    "revision": null
  }, {
    "url": "assets/ClientDashboard-dIhUIQXU.js",
    "revision": null
  }, {
    "url": "assets/ClientApprovals-6TN7y3Gz.js",
    "revision": null
  }, {
    "url": "assets/ChangePasswordPage-BhOyh_pK.js",
    "revision": null
  }, {
    "url": "assets/CatalogPage-CKKh-LYt.js",
    "revision": null
  }, {
    "url": "assets/Card-BvlJYTV6.js",
    "revision": null
  }, {
    "url": "assets/browser-storage-B9UsxX0B.js",
    "revision": null
  }, {
    "url": "assets/BriefsPage-Ch-MSNEo.js",
    "revision": null
  }, {
    "url": "assets/booking-utils-DfHGxcnP.js",
    "revision": null
  }, {
    "url": "assets/BillingPage-DlIleUt5.js",
    "revision": null
  }, {
    "url": "assets/AvailabilityCalendarPage-rG-YTosR.css",
    "revision": null
  }, {
    "url": "assets/AvailabilityCalendarPage-CKKKR51g.js",
    "revision": null
  }, {
    "url": "assets/AuditPanel-D1jpE9t_.js",
    "revision": null
  }, {
    "url": "assets/AudiovisualPage-BhjpVUX6.js",
    "revision": null
  }, {
    "url": "assets/attendance-CXsJyhHs.css",
    "revision": null
  }, {
    "url": "assets/attendance-Bga2yN8l.js",
    "revision": null
  }, {
    "url": "assets/ApprovalsPage-DMUKt0DW.js",
    "revision": null
  }, {
    "url": "assets/AgendaPage-DCBOpgV8.js",
    "revision": null
  }, {
    "url": "assets/AgendaPage-CLtEIc5k.css",
    "revision": null
  }, {
    "url": "favicon.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "icon-192x192.png",
    "revision": "a73bc966c7f6d56022a2895d7565803d"
  }, {
    "url": "icon-512x512.png",
    "revision": "db655ece58a63a7d2671b0500f521ed4"
  }, {
    "url": "icon-maskable-512x512.png",
    "revision": "88bd2bbc3188d0379158c769966c6d52"
  }, {
    "url": "brand/la-vitamina-lockup.png",
    "revision": "20c91965ae5e52f4159fe126e84030a2"
  }, {
    "url": "brand/la-vitamina-mark.svg",
    "revision": "3e5f4c59f230c3a3df3225d34e3ec6f2"
  }, {
    "url": "manifest.webmanifest",
    "revision": "af96711da5efd278acf5f820810b67bd"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
