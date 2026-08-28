# ExpiryGuard frontend v5.3.0

Frontend for the tenant-native ExpiryGuard portal.

v5.3.0 adds Microsoft Entra App Registration secret monitoring to the existing Apple/Intune expiry dashboard and Teams notification flow.

New UI elements:

- Entra app-secret source card.
- Secret-specific detail metadata.
- **Update Graph access** action under Manage customers for re-consent of existing customer tenants.

No frontend configuration values are added. `config.js` remains unchanged.


## v5.3.1 frontend homepage

Frontend-only update to the signed-out landing page:

- shorter hero copy
- product explanation section
- static example dashboard/demo
- demo/setup contact section
- existing Cloud247 tools section retained unchanged
- NO/EN translations and service-worker cache bump

Worker/API remains v5.3.0.

## v5.3.2 Tenant Admin sync

Tenant Admin can synchronize only the signed-in customer tenant. Cloud247 Super Admin keeps the global Sync all action. No D1 migration is required.


## v5.3.3 frontend UX

- Sync-knappen viser nå pågående synk med spinner og et tydelig animert resultatkort når synk er fullført eller feiler.
- Cloud247 Super Admin beholder `Synkroniser alle`; Tenant Admin beholder `Synkroniser` for kun egen tenant.
- Statusflisene Totalt, Planlagt, Start nå, Haster, Kritisk og Utløpt er klikkbare og styrer det eksisterende statusfilteret.
- Klikk på aktiv statusflis en gang til for å gå tilbake til alle statuser.
- Frontend-only endring. Ingen D1-migrering eller Worker-endring kreves fra v5.3.2.
