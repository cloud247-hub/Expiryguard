window.EXPIRYGUARD_CONFIG = Object.freeze({
  // Cloudflare Worker URL after deploy.
  apiBase: 'https://cloud247-expiryguard-api.sebastian-be1.workers.dev',
  appUrl: 'https://expiry.cloud247.no/',

  // Single-tenant management login. These are public identifiers, not secrets.
  auth: Object.freeze({
    tenantId: 'ac44fff9-4182-4373-9a08-e05726cc515c',
    spaClientId: 'c8db6585-28de-47e4-aebb-0028545506be',
    apiClientId: '8912fa4a-586a-40f9-9e8e-8010c2c849a6',
    apiScope: 'api://8912fa4a-586a-40f9-9e8e-8010c2c849a6/access_as_user'
  })
});
