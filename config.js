window.EXPIRYGUARD_CONFIG = Object.freeze({
  // Cloudflare Worker URL after deploy.
  apiBase: 'https://expiryguard-api.YOUR-SUBDOMAIN.workers.dev',
  appUrl: 'https://expiry.cloud247.no/',
  managementUrl: 'https://expiry.cloud247.no/',
  customerPortalUrl: 'https://expiry.cloud247.no/customer.html',

  // Existing single-tenant management login.
  auth: Object.freeze({
    tenantId: 'ac44fff9-4182-4373-9a08-e05726cc515c',
    spaClientId: 'c8db6585-28de-47e4-aebb-0028545506be',
    apiClientId: '8912fa4a-586a-40f9-9e8e-8010c2c849a6',
    apiScope: 'api://8912fa4a-586a-40f9-9e8e-8010c2c849a6/access_as_user'
  }),

  // New V5 customer portal. Keep SPA and API as separate multitenant
  // app registrations, mirroring the management login architecture.
  customerAuth: Object.freeze({
    authority: 'organizations',
    spaClientId: '06e930e8-339d-48af-8c7f-443095ea376a',
    apiClientId: '56ac825f-6800-4fad-b7be-f28e2338d591',
    apiScope: 'api://56ac825f-6800-4fad-b7be-f28e2338d591/access_as_user'
  })
});
