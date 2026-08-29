# ExpiryGuard v5.3.5 – Security Hardening

Frontend release paired with Worker v5.3.5.

Security-focused changes:
- CSP tightened: frontend no longer allows direct `connect-src` to `login.microsoftonline.com`; OAuth stays server-side through `api.expiry.cloud247.no`.
- `base-uri` is `none`.
- `X-Permitted-Cross-Domain-Policies: none` added to the header template.
- Service Worker cache bumped and continues to exclude API, OAuth, navigation, `config.js`, cross-origin and Authorization requests.
- NO/EN includes the generic hardened server-error message.

The frontend still uses `https://api.expiry.cloud247.no` as its API base.
