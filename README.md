# ExpiryGuard frontend v5.4.0

Complete static frontend paired with Worker v5.4.0. Publish the contents of this directory, not the repository root.

New `notifications.js` implements tenant-scoped recipient management, email channel settings, save-and-test, and the separate notification log. It loads before `app.js`. Only Tenant Admin and Cloud247 Super Admin see the controls; all authorization is also enforced on the server.

Publish `index.html`, `app.js`, `notifications.js`, `styles.css`, `i18n.js`, `sw.js` together, retaining the supplied configuration and assets. API origin remains unchanged. Script/CSS URLs, the footer and service-worker cache are versioned to 5.4.0. The session-storage key deliberately retains its existing name; it is not a cache version.

The browser only calls the existing API origin. No Brevo secret is stored or entered here. The existing CSP remains unchanged. The service worker continues to exclude API/OAuth requests, navigation, `config.js`, cross-origin and Authorization requests from caching.

NO/EN settings labels and Norwegian/English email content are supported independently. Dialogs were checked at 1440px and 390px with a simulated API. No live provider interaction occurred in those tests.

See `../UPGRADE-V5.4.0.md` for the required backend migration and Brevo setup before activation.
