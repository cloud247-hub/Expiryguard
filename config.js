window.EXPIRYGUARD_CONFIG = Object.freeze({
  // Cloudflare Worker URL after deploy.
  apiBase: 'https://expiryguard-api.YOUR-SUBDOMAIN.workers.dev',
  appUrl: 'https://expiry.cloud247.no/',
  managementUrl: 'https://expiry.cloud247.no/',
  customerPortalUrl: 'https://expiry.cloud247.no/customer.html',

  // Existing single-tenant management login.
  auth: Object.freeze({
    tenantId: 'YOUR_MANAGEMENT_TENANT_ID',
    spaClientId: 'YOUR_DASHBOARD_SPA_CLIENT_ID',
    apiClientId: 'YOUR_DASHBOARD_API_CLIENT_ID',
    apiScope: 'api://YOUR_DASHBOARD_API_CLIENT_ID/access_as_user'
  }),

  // New V5 customer portal. Keep SPA and API as separate multitenant
  // app registrations, mirroring the management login architecture.
  customerAuth: Object.freeze({
    authority: 'organizations',
    spaClientId: 'YOUR_CUSTOMER_PORTAL_SPA_CLIENT_ID',
    apiClientId: 'YOUR_CUSTOMER_PORTAL_API_CLIENT_ID',
    apiScope: 'api://YOUR_CUSTOMER_PORTAL_API_CLIENT_ID/access_as_user'
  })
});
