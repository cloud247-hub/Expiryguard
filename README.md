# ExpiryGuard

## Microsoft-innlogging

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
