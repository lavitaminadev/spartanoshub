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
    "revision": "172cb0ccd45fe3e670139c25b173e016"
  }, {
    "url": "assets/WaitlistPage-_NeEsD1a.js",
    "revision": null
  }, {
    "url": "assets/vendor-router-QsOHUjlc.js",
    "revision": null
  }, {
    "url": "assets/vendor-react-BnSc9Rcr.js",
    "revision": null
  }, {
    "url": "assets/vendor-query-BbYCwu_F.js",
    "revision": null
  }, {
    "url": "assets/vendor-charts-Ce2_npR0.js",
    "revision": null
  }, {
    "url": "assets/vendor-CGvGNCRP.js",
    "revision": null
  }, {
    "url": "assets/UsersPage-D3-MHs29.js",
    "revision": null
  }, {
    "url": "assets/Tooltip-CuALYsPc.js",
    "revision": null
  }, {
    "url": "assets/StatusBadge--7MsYwE5.js",
    "revision": null
  }, {
    "url": "assets/status-palette-C32xZ10X.js",
    "revision": null
  }, {
    "url": "assets/status-labels-DUO2UOn5.js",
    "revision": null
  }, {
    "url": "assets/SettingsPage-D0tVWlEg.js",
    "revision": null
  }, {
    "url": "assets/SessionsPage-C_vKllnT.js",
    "revision": null
  }, {
    "url": "assets/SecurityPage-_odkwmbG.js",
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
    "url": "assets/ResetPasswordPage-KbQgbGgh.js",
    "revision": null
  }, {
    "url": "assets/ReservationsPage-IxteJ3n-.js",
    "revision": null
  }, {
    "url": "assets/ReservationsPage-CRWX_r4P.css",
    "revision": null
  }, {
    "url": "assets/ReservationsAnalyticsPage-CNDcbpqP.js",
    "revision": null
  }, {
    "url": "assets/ReservationResults-BqP-tfa2.js",
    "revision": null
  }, {
    "url": "assets/ReservationBuilderPage-Bzuu-Jqt.js",
    "revision": null
  }, {
    "url": "assets/ReportsPage-CxjuHysL.js",
    "revision": null
  }, {
    "url": "assets/QueryErrorState-D3sI17EE.js",
    "revision": null
  }, {
    "url": "assets/PulsoEspartano-hLd6FTRW.js",
    "revision": null
  }, {
    "url": "assets/PublicReservationPage-wC1DOCYI.js",
    "revision": null
  }, {
    "url": "assets/PublicReservationPage-C5DhmJ59.css",
    "revision": null
  }, {
    "url": "assets/ProductionPage-xWifSbj-.js",
    "revision": null
  }, {
    "url": "assets/PasswordField-uj4WjGJY.js",
    "revision": null
  }, {
    "url": "assets/PageHero-DW_sGVob.css",
    "revision": null
  }, {
    "url": "assets/PageHero-BBNIoCQ6.js",
    "revision": null
  }, {
    "url": "assets/OperationsPage-BF6sRpLg.js",
    "revision": null
  }, {
    "url": "assets/OnboardingPage-BoygDind.js",
    "revision": null
  }, {
    "url": "assets/OAuthCallbackPage-BVNJeXTu.js",
    "revision": null
  }, {
    "url": "assets/MonthlyReportCard-C7Zl_Aay.js",
    "revision": null
  }, {
    "url": "assets/Modal-drCVtS7T.js",
    "revision": null
  }, {
    "url": "assets/MeetingsPage-BJf8vh_5.js",
    "revision": null
  }, {
    "url": "assets/LoginPage-WazlzDBI.js",
    "revision": null
  }, {
    "url": "assets/local-time-CDXSxa83.js",
    "revision": null
  }, {
    "url": "assets/LeadsPage-CkGoLS7_.js",
    "revision": null
  }, {
    "url": "assets/KnowledgePage-rAMEhxuq.js",
    "revision": null
  }, {
    "url": "assets/IntegrationsPage-y0FBx04n.js",
    "revision": null
  }, {
    "url": "assets/IntakePage-DMKR-Hes.js",
    "revision": null
  }, {
    "url": "assets/index-lu3OpEKN.css",
    "revision": null
  }, {
    "url": "assets/index-Bpp4H8CA.js",
    "revision": null
  }, {
    "url": "assets/ImageUpload-CPZ3hQfU.js",
    "revision": null
  }, {
    "url": "assets/GovernancePage-DzEaU-SW.js",
    "revision": null
  }, {
    "url": "assets/GamificationPage-D4o5zyGz.js",
    "revision": null
  }, {
    "url": "assets/ForgotPasswordPage-CDfDHIi7.js",
    "revision": null
  }, {
    "url": "assets/ForbiddenState-BhTUzana.js",
    "revision": null
  }, {
    "url": "assets/FirstAccessPage-Cz8jPj_s.js",
    "revision": null
  }, {
    "url": "assets/EmptyState-luahATiq.js",
    "revision": null
  }, {
    "url": "assets/DocumentsPage-CMz-Sc62.js",
    "revision": null
  }, {
    "url": "assets/DirectionPage-NGEbwEQC.js",
    "revision": null
  }, {
    "url": "assets/DataTable-CpITzXDC.js",
    "revision": null
  }, {
    "url": "assets/DashboardPage-DwWibBB_.js",
    "revision": null
  }, {
    "url": "assets/CrmRecordsPage-DDl_vv3I.js",
    "revision": null
  }, {
    "url": "assets/ContractsPage-CAMISZEy.js",
    "revision": null
  }, {
    "url": "assets/ContentGridPage-eQUtWEXj.js",
    "revision": null
  }, {
    "url": "assets/ConfirmDialog-zdzasPkE.js",
    "revision": null
  }, {
    "url": "assets/CloudinaryConfigModal-BIIxtfw3.js",
    "revision": null
  }, {
    "url": "assets/ClientsPage-RuBfMJ7y.css",
    "revision": null
  }, {
    "url": "assets/ClientsPage-BuzyFTT4.js",
    "revision": null
  }, {
    "url": "assets/ClientReports-ChShYf2X.js",
    "revision": null
  }, {
    "url": "assets/ClientMeetings-CoLM6QJG.js",
    "revision": null
  }, {
    "url": "assets/ClientLayout-BWF8RZzv.js",
    "revision": null
  }, {
    "url": "assets/ClientGrid-DcHLiv_S.js",
    "revision": null
  }, {
    "url": "assets/ClientDetailPage-BmUgu6ZF.js",
    "revision": null
  }, {
    "url": "assets/ClientDashboard-7wE___nd.js",
    "revision": null
  }, {
    "url": "assets/ClientApprovals-lLHdnONm.js",
    "revision": null
  }, {
    "url": "assets/ChangePasswordPage-BDrGCOHK.js",
    "revision": null
  }, {
    "url": "assets/CatalogPage-BO-7hUTW.js",
    "revision": null
  }, {
    "url": "assets/Card-CUrOcWi_.js",
    "revision": null
  }, {
    "url": "assets/browser-storage-B9UsxX0B.js",
    "revision": null
  }, {
    "url": "assets/BriefsPage-B3z0sijc.js",
    "revision": null
  }, {
    "url": "assets/booking-utils-DfHGxcnP.js",
    "revision": null
  }, {
    "url": "assets/BillingPage-BW0l5pUB.js",
    "revision": null
  }, {
    "url": "assets/AvailabilityCalendarPage-rG-YTosR.css",
    "revision": null
  }, {
    "url": "assets/AvailabilityCalendarPage-Q6A4Lkda.js",
    "revision": null
  }, {
    "url": "assets/AuditPanel-D5MlQ9C8.js",
    "revision": null
  }, {
    "url": "assets/AudiovisualPage-DU4LS_1i.js",
    "revision": null
  }, {
    "url": "assets/attendance-CXsJyhHs.css",
    "revision": null
  }, {
    "url": "assets/attendance-C7FS5Wbo.js",
    "revision": null
  }, {
    "url": "assets/ApprovalsPage-BaCLKraQ.js",
    "revision": null
  }, {
    "url": "assets/AgendaPage-qmdijhBv.js",
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
