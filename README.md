# ExpiryGuard v4 frontend – GitHub Pages

## Microsoft-innlogging

Frontend er en statisk SPA og bruker OAuth 2.0 Authorization Code Flow med PKCE. Det ligger ingen client secret i GitHub Pages.

### 1. Opprett `ExpiryGuard Dashboard API`

I management-tenant:

1. App registrations → New registration.
2. Navn: `ExpiryGuard Dashboard API`.
3. Supported account types: **Accounts in this organizational directory only**.
4. Expose an API → godta `api://<API-client-id>`.
5. Add a scope:
   - Scope name: `access_as_user`
   - Who can consent: Admins and users (eller Admins only hvis du ønsker det)
   - State: Enabled
6. Åpne **Manifest** for API-appen og sett `requestedAccessTokenVersion` til `2`. Worker-en validerer v2-tokenformatet eksplisitt.
7. Kopier Application (client) ID – dette er `apiClientId`.

### 2. Opprett `ExpiryGuard Dashboard SPA`

1. Ny single-tenant app registration: `ExpiryGuard Dashboard SPA`.
2. Authentication → Add platform → **Single-page application**.
3. Legg til redirect URIs:
   - `https://expiry.cloud247.no/`
   - `http://localhost:8080/` for lokal test
4. API permissions → My APIs → `ExpiryGuard Dashboard API` → delegated `access_as_user`.
5. Grant admin consent i management-tenant hvis ønskelig.
6. Ikke opprett client secret for SPA-en.

### 3. Fyll ut `config.js`

```js
window.EXPIRYGUARD_CONFIG = Object.freeze({
  apiBase: 'https://DIN-WORKER.workers.dev',
  appUrl: 'https://expiry.cloud247.no/',
  auth: Object.freeze({
    tenantId: 'MANAGEMENT-TENANT-GUID',
    spaClientId: 'DASHBOARD-SPA-CLIENT-ID',
    apiClientId: 'DASHBOARD-API-CLIENT-ID',
    apiScope: 'api://DASHBOARD-API-CLIENT-ID/access_as_user'
  })
});
```

`tenantId`, client IDs og scope er offentlige identifikatorer og kan ligge i frontend. **Ingen secrets skal ligge her.**

## Hva brukeren opplever

- Før dashboardet vises: **Logg inn med Microsoft**.
- Brukeren velger en konto fra management-tenant.
- Entra sender authorization code tilbake til SPA-en.
- SPA-en løser inn koden med PKCE og får et access token til ExpiryGuard API.
- Worker validerer tokenet før data returneres.
- Innlogget navn/konto vises i headeren.
- `Logg ut` tømmer lokal ExpiryGuard-session.

Access- og refresh-token lagres bare i `sessionStorage`, så de forsvinner når fanens session avsluttes. Frontend bruker aldri ID-token som API-autorisasjon; Worker mottar access token for det eksponerte API-scope-et.

## Kunde-consent

Når du velger **Legg til kunde**, brukes den separate Graph Connector-appregistreringen på Worker-siden. Kunden gir admin consent til Microsoft Graph application permission. Dette er uavhengig av hvem som logger inn i ExpiryGuard-dashboardet.
