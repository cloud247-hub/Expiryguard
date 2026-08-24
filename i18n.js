(() => {
  'use strict';

  const STORAGE_KEY = 'cloud247-expiryguard-v5-language';
  const textOrigins = new WeakMap();
  const attrOrigins = new WeakMap();
  const listeners = new Set();

  const EN = {
    '💬 Teams-varsler': '💬 Teams notifications',
    'Teams-varsler': 'Teams notifications',
    'MICROSOFT TEAMS': 'MICROSOFT TEAMS',
    'Send automatiske ExpiryGuard-varsler til en Teams-kanal via Microsoft Teams Workflows. Tenant Admin styrer sin egen tenant; Cloud247 Super Admin kan konfigurere alle kunder.': 'Send automatic ExpiryGuard notifications to a Teams channel through Microsoft Teams Workflows. Tenant Admin manages their own tenant; Cloud247 Super Admin can configure all customers.',
    'Aktiver Teams-varsler': 'Enable Teams notifications',
    'Varsler sendes etter planlagt eller manuell synkronisering. Samme varsel sendes bare én gang per utløpsdato og nivå.': 'Notifications are sent after scheduled or manual synchronization. The same alert is only sent once per expiration date and level.',
    'Teams Workflows webhook-URL': 'Teams Workflows webhook URL',
    'Kanalnavn / beskrivelse': 'Channel name / description',
    'F.eks. IT Drift / ExpiryGuard': 'E.g. IT Operations / ExpiryGuard',
    'Start fornyelse': 'Start renewal',
    'Når anbefalt startvindu nås.': 'When the recommended start window is reached.',
    'Haster': 'Urgent',
    'Når elementet går inn i hastevinduet.': 'When the item enters the urgent window.',
    'Kritisk': 'Critical',
    'Når elementet går inn i kritiskvinduet.': 'When the item enters the critical window.',
    'Utløpt': 'Expired',
    'Når utløpsdatoen er passert.': 'When the expiration date has passed.',
    'Slik kobler du til Teams': 'How to connect Teams',
    'Opprett en Workflow i ønsket Teams-kanal med triggeren When a Teams webhook request is received, sett trigger-tilgangen til Anyone, kopier den aktuelle callback-URL-en og lim den inn her. Bruk den nyeste URL-en fra Workflows.': 'Create a Workflow in the desired Teams channel using the When a Teams webhook request is received trigger, set trigger access to Anyone, copy the current callback URL, and paste it here. Use the latest URL shown in Workflows.',
    'Webhook-URL-en behandles som en hemmelighet. Den krypteres med AES-256-GCM i Worker før lagring i D1 og returneres aldri til nettleseren etter lagring.': 'The webhook URL is treated as a secret. It is encrypted with AES-256-GCM in the Worker before being stored in D1 and is never returned to the browser after storage.',
    'Fjern webhook': 'Remove webhook',
    'Send testvarsel': 'Send test notification',
    'Lagre Teams-varsler': 'Save Teams notifications',
    'Kunden setter Assignment required = Yes på ExpiryGuard Enterprise Application og tildeler brukere under Users and groups. På Entra Free må brukere tildeles individuelt; gruppebasert assignment krever P1/P2. Etter første innlogging får brukeren status Venter på rolle, og Tenant Admin eller Cloud247 tildeler Viewer, Editor eller Tenant Admin i ExpiryGuard.': 'The customer sets Assignment required = Yes on the ExpiryGuard Enterprise Application and assigns users under Users and groups. On Entra Free, users must be assigned individually; group-based assignment requires P1/P2. After the first sign-in, the user is Waiting for role, and Tenant Admin or Cloud247 assigns Viewer, Editor, or Tenant Admin in ExpiryGuard.',
    'Oppgi Tenant ID og kundenavn. ExpiryGuard lager én Microsoft admin-consent-lenke for den samme ExpiryGuard-appen som brukes til Graph og portalinnlogging. Etter godkjenning tester backend Graph-tilgangen. Kunden setter deretter Assignment required = Yes og tildeler brukere under Users and groups. Roller tildeles inne i ExpiryGuard.': 'Enter the Tenant ID and customer name. ExpiryGuard creates one Microsoft admin-consent link for the same ExpiryGuard app used for Graph and portal sign-in. After approval, the backend tests Graph access. The customer then sets Assignment required = Yes and assigns users under Users and groups. Roles are assigned inside ExpiryGuard.',
    'Kunden er koblet til. Sett Assignment required = Yes og tildel brukere i kundens Enterprise Application. Roller tildeles i ExpiryGuard.': 'The customer is connected. Set Assignment required = Yes and assign users in the customer Enterprise Application. Roles are assigned in ExpiryGuard.',
    'Microsoft Entra styrer hvem som får logge inn. Rollen styres i ExpiryGuard. Ingen passord lagres i ExpiryGuard.': 'Microsoft Entra controls who can sign in. The role is managed in ExpiryGuard. ExpiryGuard never stores passwords.',
    '👥 Brukere og roller': '👥 Users and roles',
    'Brukere og roller': 'Users and roles',
    'TILGANG': 'ACCESS',
    'Kundens Entra-rolle er grunnlaget. Cloud247 Super Admin kan se effektiv rolle, overstyre rollen eller blokkere brukeren.': 'The customer Entra role is the baseline. Cloud247 Super Admin can see the effective role, override the role, or block the user.',
    'Tenant-native RBAC': 'Tenant-native RBAC',
    'Microsoft Entra bestemmer hvem som får logge inn. Rollen Viewer, Editor eller Tenant Admin lagres i ExpiryGuard. Tenant Admin kan styre roller i egen tenant; Cloud247 Super Admin kan styre alle kunder og blokkere ved behov.': 'Microsoft Entra controls who can sign in. Viewer, Editor, and Tenant Admin roles are stored in ExpiryGuard. Tenant Admin can manage roles in their own tenant; Cloud247 Super Admin can manage all customers and block access when needed.',
    'Hold kontroll på Apple Push-sertifikater, ADE- og VPP-tokens og andre utløpsdatoer. Cloud247 får samlet oversikt, mens kundebrukere ser kun sin egen Microsoft-tenant.': 'Keep track of Apple Push certificates, ADE and VPP tokens, and other expiration dates. Cloud247 gets a consolidated overview, while customer users can only see their own Microsoft tenant.',
    'Logg inn med Microsoft-kontoen din. Cloud247 Super Admin ser alle kunder; kundebrukere får kun tilgang til sin egen tenant.': 'Sign in with your Microsoft account. Cloud247 Super Admin sees all customers; customer users can only access their own tenant.',
    'Multi-tenant oversikt med Microsoft Graph, handlingsvinduer, live nedtelling og tenant-isolert tilgang.': 'Multi-tenant overview with Microsoft Graph, action windows, live countdowns, and tenant-isolated access.',
    'Innloggingen håndteres av Cloudflare Worker mot Microsoft Entra ID. Worker validerer Microsoft ID-tokenet og oppretter en kort ExpiryGuard-session. Kundens validerte Tenant ID (tid) er den faste tenant-grensen for alle API-kall.': "Sign-in is handled by the Cloudflare Worker against Microsoft Entra ID. The Worker validates the Microsoft ID token and creates a short ExpiryGuard session. The customer's validated Tenant ID (tid) is the fixed tenant boundary for every API call.",
    'Cloud247 Super Admin': 'Cloud247 Super Admin',
    'Denne handlingen krever Cloud247 Super Admin': 'This action requires Cloud247 Super Admin',
    'Tenant Viewer har kun lesetilgang': 'Tenant Viewer has read-only access',
    'Logg inn med Microsoft. Kundebrukere bruker sin egen Entra-tenant og får kun tilgang til sin egen kunde.': 'Sign in with Microsoft. Customer users use their own Entra tenant and can only access their own customer data.',
    'Tilgang styres av godkjente Microsoft Object ID-er. Ingen passord lagres i ExpiryGuard.': 'Access is controlled by approved Microsoft Object IDs. ExpiryGuard never stores passwords.',
    'Første innlogging registrerer en tilgangsforespørsel. En ExpiryGuard-administrator godkjenner deg som Viewer eller Admin.': 'Your first sign-in registers an access request. An ExpiryGuard administrator approves you as Viewer or Admin.',
    '👥 Portalbrukere': '👥 Portal users',
    'Portalbrukere': 'Portal users',
    'Brukere registreres automatisk første gang de logger inn. Godkjenn dem som Viewer eller Admin her.': 'Users are registered automatically the first time they sign in. Approve them as Viewer or Admin here.',
    'Alle kunder': 'All customers',
    '↻ Oppdater': '↻ Refresh',
    'Ingen Entra Premium kreves': 'No Entra Premium required',
    'Microsoft brukes kun til sikker innlogging. Tilgang og rolle lagres i ExpiryGuard D1 og knyttes til brukerens validerte Tenant ID (tid) + Object ID (oid).': "Microsoft is only used for secure sign-in. Access and role are stored in ExpiryGuard D1 and tied to the user's validated Tenant ID (tid) + Object ID (oid).",
    'Ingen portalbrukere ennå.': 'No portal users yet.',
    'Godkjenn Viewer': 'Approve Viewer',
    'Godkjenn Admin': 'Approve Admin',
    'Gjør til Viewer': 'Make Viewer',
    'Gjør til Admin': 'Make Admin',
    'Avvis': 'Deny',
    'Portaltilgang oppdatert': 'Portal access updated',
    'Kunne ikke oppdatere portaltilgang': 'Could not update portal access',
    'Henter portalbrukere…': 'Loading portal users…',
    'Kunne ikke hente portalbrukere': 'Could not load portal users',
    'Portalbruker godkjent': 'Portal user approved',
    'Portalbruker avvist': 'Portal user denied',
    'Portalbruker satt til ventende': 'Portal user set to pending',
    'Portalbruker fjernet': 'Portal user removed',
    'Tilgangen din venter på godkjenning fra ExpiryGuard-administrator.': 'Your access is waiting for approval from the ExpiryGuard administrator.',
    'Tilgangsforespørselen er registrert. En ExpiryGuard-administrator må godkjenne brukeren før kundeportalen åpnes.': 'Your access request has been registered. An ExpiryGuard administrator must approve the user before the customer portal opens.',
    'Tilgangen til ExpiryGuard kundeportal er avvist eller deaktivert.': 'Access to the ExpiryGuard customer portal has been denied or disabled.',
    'Denne Microsoft-tenanten er ikke registrert som kunde i ExpiryGuard': 'This Microsoft tenant is not registered as a customer in ExpiryGuard',
    'Brukeren er ikke godkjent som ExpiryGuard management-bruker': 'The user is not approved as an ExpiryGuard management user',
    'Worker mangler management-allowlist. Sett AUTH_ALLOWED_USER_IDS til Object ID for godkjente management-brukere.': 'The Worker is missing the management allowlist. Set AUTH_ALLOWED_USER_IDS to the Object ID of approved management users.',
    'Logg ut': 'Sign out',
    'Logg inn med Microsoft': 'Sign in with Microsoft',
    'Ingen admin-token eller passord lagres i frontend.': 'No admin token or password is stored in the frontend.',
    'Er du kunde?': 'Are you a customer?',
    'Åpne kundeportalen →': 'Open customer portal →',
    'EXPIRYGUARD KUNDEPORTAL': 'EXPIRYGUARD CUSTOMER PORTAL',
    'Få oversikt over sertifikater, tokens og andre utløpsdatoer for din egen Microsoft-tenant.': 'Get an overview of certificates, tokens, and other expiration dates for your own Microsoft tenant.',
    'Din tenant': 'Your tenant',
    'KUNDEPORTAL': 'CUSTOMER PORTAL',
    'Åpne kundeportalen': 'Open customer portal',
    'Logg inn med Microsoft-kontoen din. ExpiryGuard bruker tenant-ID-en fra den validerte innloggingen og viser kun data for din organisasjon.': 'Sign in with your Microsoft account. ExpiryGuard uses the tenant ID from the validated sign-in and only shows data for your organization.',
    'Du får bare tilgang dersom tenant-en din er aktivert i ExpiryGuard.': 'You only get access if your tenant has been enabled in ExpiryGuard.',
    'Cloud247 management?': 'Cloud247 management?',
    'Åpne management →': 'Open management →',
    'Se når noe utløper – og': 'See when something expires – and',
    'når dere bør begynne å fornye det': 'when you should start renewing it',
    'Sikker oversikt for kun deres egen Microsoft-tenant, med handlingsvinduer, live nedtelling og varsler.': 'A secure overview for your own Microsoft tenant only, with action windows, live countdowns, and notifications.',
    'Det er ingen registrerte utløpsdatoer for din tenant akkurat nå.': 'There are no registered expiration dates for your tenant right now.',
    'Logg inn for å åpne kundeportalen.': 'Sign in to open the customer portal.',
    'Logg inn for å åpne management-dashboardet.': 'Sign in to open the management dashboard.',
    'Logg inn med Microsoft for å åpne kundeportalen.': 'Sign in with Microsoft to open the customer portal.',
    'Logg inn med management-kontoen for å åpne dashboardet.': 'Sign in with the management account to open the dashboard.',
    'Innloggingen tilhører en annen ExpiryGuard-portal.': 'The sign-in belongs to a different ExpiryGuard portal.',
    'Denne siden er kun for Cloud247 management.': 'This page is for Cloud247 management only.',
    'Denne siden er kun for kundeportal-brukere.': 'This page is for customer portal users only.',
    'Hold kontroll på Apple Push-sertifikater, ADE- og VPP-tokens og andre utløpsdatoer på tvers av kundene dine.': 'Keep track of Apple Push certificates, ADE and VPP tokens, and other expiration dates across your customers.',
    'Fornyelsesplan': 'Renewal plan',
    'Live nedtelling': 'Live countdown',
    'MICROSOFT-INNLOGGING': 'MICROSOFT SIGN-IN',
    'Åpne dashboardet': 'Open the dashboard',
    'Logg inn med management-kontoen din for å administrere kunder og utløpsdata.': 'Sign in with your management account to manage customers and expiration data.',
    'Cloud247 / management': 'Cloud247 / management',
    'Full administrasjon av alle kunder': 'Full administration of all customers',
    'Kundeportal': 'Customer portal',
    'Se kun din egen Microsoft-tenant': 'View only your own Microsoft tenant',
    'Velg innloggingstype. Ingen passord lagres i ExpiryGuard.': 'Choose a sign-in type. ExpiryGuard never stores passwords.',
    'VIL DU SE DET I PRAKSIS?': 'WANT TO SEE IT IN ACTION?',
    'Få ditt eget ExpiryGuard-dashboard': 'Get your own ExpiryGuard dashboard',
    'Ta kontakt for en kort demo og hjelp til å sette opp ExpiryGuard mot din Microsoft-tenant. For MSP-er kan vi også klargjøre dashboardet for kundene dine.': 'Get in touch for a short demo and help setting up ExpiryGuard for your Microsoft tenant. If you are an MSP, we can also prepare the dashboard for your customer tenants.',
    'Sikker Microsoft-innlogging': 'Secure Microsoft sign-in',
    'Automatisk Intune- og Graph-sync': 'Automatic Intune and Graph sync',
    'Egen kundeportal per tenant': 'Dedicated customer portal per tenant',
    'Ta kontakt for demo': 'Contact me for a demo',
    'ENKLE PRISER': 'SIMPLE PRICING',
    'Velg modellen som passer': 'Choose the plan that fits',
    'For IT-avdelinger': 'For IT departments',
    '/ tenant / mnd': '/ tenant / month',
    'For IT-avdelinger som følger opp selv.': 'For IT departments that manage renewals themselves.',
    'For IT-leverandører': 'For IT providers',
    '/ mnd': '/ month',
    '+ 59 kr / tenant': '+ NOK 59 / tenant',
    'For IT-leverandører som følger opp flere kunder.': 'For IT providers managing multiple customers.',
    'Se ikke bare når noe utløper – se': 'Do not just see when something expires – see',
    'når du bør begynne å fornye det': 'when you should start renewing it',
    'Multi-tenant oversikt med Microsoft Graph, handlingsvinduer, live nedtelling og sikker kundeportal.': 'Multi-tenant overview with Microsoft Graph, action windows, live countdowns, and a secure customer portal.',
    'Browser-varsler': 'Browser notifications',
    'NESTE ANBEFALTE HANDLING': 'NEXT RECOMMENDED ACTION',
    'Kobler til…': 'Connecting…',
    'Venter på data…': 'Waiting for data…',
    '↻ Synkroniser alle': '↻ Sync all',
    '🔔 Varsler': '🔔 Notifications',
    'KUNDER': 'CUSTOMERS',
    'Tenants': 'Tenants',
    'Alle kunder': 'All customers',
    'Administrer kunder': 'Manage customers',
    '+ Legg til manuelt': '+ Add manually',
    '⛶ Fullskjerm': '⛶ Full screen',
    '◫ Dashboard-modus': '◫ Dashboard mode',
    'Import': 'Import',
    'Eksporter JSON': 'Export JSON',
    'Eksporter CSV': 'Export CSV',
    'Eksporter kalender': 'Export calendar',
    '⚙ Innstillinger': '⚙ Settings',
    'Totalt': 'Total',
    'utløpsdatoer': 'expiration dates',
    'Planlagt': 'Planned',
    'ikke tid ennå': 'not due yet',
    'Start nå': 'Start now',
    'innen anbefalt vindu': 'within recommended window',
    'Haster': 'Urgent',
    'bør være i gang': 'should already be in progress',
    'Kritisk': 'Critical',
    'prioriter i dag': 'prioritize today',
    'Utløpt': 'Expired',
    'krever handling': 'requires action',
    'FORNYELSESPLAN': 'RENEWAL PLAN',
    'Hva bør du jobbe med nå?': 'What should you work on now?',
    'Sortert etter anbefalt startdato, konsekvens og tid igjen.': 'Sorted by recommended start date, impact, and time remaining.',
    'Cloud247-anbefalinger': 'Cloud247 recommendations',
    'OVERSIKT': 'OVERVIEW',
    'Ikke synkronisert ennå': 'Not synchronized yet',
    'Ingen utløpsdatoer å vise': 'No expiration dates to show',
    'Legg til en kunde og gi admin consent, eller opprett et manuelt element.': 'Add a customer and grant admin consent, or create a manual item.',
    'Kunde': 'Customer',
    'Navn': 'Name',
    'Anbefalt start': 'Recommended start',
    'Utløper': 'Expires',
    'Tid igjen': 'Time remaining',
    'Plan': 'Plan',
    'Arbeid': 'Work',
    'AUTOMATISK FRA INTUNE': 'AUTOMATIC FROM INTUNE',
    'Graph-kilder': 'Graph sources',
    'ExpiryGuard synkroniserer bare metadata som trengs for oversikten. Selve Apple-tokenet eller sertifikatet lagres ikke.': 'ExpiryGuard synchronizes only the metadata needed for the overview. The Apple token or certificate itself is never stored.',
    'Start 60 dager før · kritisk siste 14 dager': 'Start 60 days before · critical during the last 14 days',
    'Start 30 dager før · kritisk siste 7 dager': 'Start 30 days before · critical during the last 7 days',
    'HISTORIKK': 'HISTORY',
    'Siste fornyelser og endringer': 'Latest renewals and changes',
    'Oppdages automatisk når Graph får en nyere utløpsdato.': 'Detected automatically when Graph reports a newer expiration date.',
    'FLERE CLOUD247-VERKTØY': 'MORE CLOUD247 TOOLS',
    'Se mine andre verktøy': 'See my other tools',
    'Flere små verktøy for Microsoft 365, Intune, DNS og sikkerhet.': 'More lightweight tools for Microsoft 365, Intune, DNS, and security.',
    'Åpne Cloud Toolbox →': 'Open Cloud Toolbox →',
    'INGEN UTLØPTE TOKENS. FORHÅPENTLIGVIS.': 'NO EXPIRED TOKENS. HOPEFULLY.',
    'Hold ExpiryGuard våken': 'Keep ExpiryGuard awake',
    'Hvis dashboardet redder deg fra en utløpt Apple-integrasjon hos en kunde, kan du støtte videre utvikling av Cloud247-verktøyene.': 'If the dashboard saves you from an expired Apple integration at a customer, you can support continued development of the Cloud247 tools.',
    'Spander en slurk': 'Buy me a sip',
    'NY KUNDE': 'NEW CUSTOMER',
    'Koble til Microsoft tenant': 'Connect Microsoft tenant',
    'Hvordan det virker': 'How it works',
    'Oppgi Tenant ID og kundenavn. ExpiryGuard lager en Microsoft admin-consent-lenke. Etter godkjenning tester backend Graph-tilgangen og legger kunden til.': 'Enter the Tenant ID and customer name. ExpiryGuard creates a Microsoft admin-consent link. After approval, the backend tests Graph access and adds the customer.',
    'Kundenavn': 'Customer name',
    'Avbryt': 'Cancel',
    'Opprett consent-lenke →': 'Create consent link →',
    'MULTI-TENANT': 'MULTI-TENANT',
    'Ferdig': 'Done',
    'MANUELT ELEMENT': 'MANUAL ITEM',
    'REDIGER MANUELT ELEMENT': 'EDIT MANUAL ITEM',
    'Legg til utløpsdato': 'Add expiration date',
    'Rediger utløpsdato': 'Edit expiration date',
    'Type': 'Type',
    'Lisens / abonnement': 'License / subscription',
    'Apple / Intune annet': 'Apple / Intune other',
    'Egendefinert': 'Custom',
    'Konsekvens': 'Impact',
    'Høy': 'High',
    'Medium': 'Medium',
    'Lav': 'Low',
    'Start fornyelse før': 'Start renewal before',
    'dager før utløp': 'days before expiration',
    'Haster fra': 'Urgent from',
    'Kritisk fra': 'Critical from',
    'Eier / konto': 'Owner / account',
    'Administrasjonslenke': 'Administration link',
    'Notater': 'Notes',
    'Lagre': 'Save',
    'Detaljer': 'Details',
    'ANBEFALING': 'RECOMMENDATION',
    'ARBEIDSSTATUS': 'WORK STATUS',
    'Ikke startet': 'Not started',
    'Pågår': 'In progress',
    'Venter': 'Waiting',
    'Fornyet': 'Renewed',
    'Arbeidsnotat': 'Work note',
    'Lagre arbeidsstatus': 'Save work status',
    'Kopier ticket-tekst': 'Copy ticket text',
    'Åpne dokumentasjon ↗': 'Open documentation ↗',
    'Åpne administrasjon ↗': 'Open administration ↗',
    'Lukk': 'Close',
    'INNSTILLINGER': 'SETTINGS',
    'Standard startvindu': 'Default start window',
    '90 dager': '90 days',
    '60 dager': '60 days',
    '45 dager': '45 days',
    '30 dager': '30 days',
    '14 dager': '14 days',
    '7 dager': '7 days',
    'Varslingsfrekvens': 'Notification frequency',
    'Hver 6. time ved behov': 'Every 6 hours when needed',
    'Hver 12. time ved behov': 'Every 12 hours when needed',
    'Maks én gang per døgn': 'At most once per day',
    'Varsle når anbefalt startdato passeres, ved hast og ved kritisk status.': 'Notify when the recommended start date is reached, and for urgent and critical status.',
    'Roter kunder i dashboard-modus': 'Rotate customers in dashboard mode',
    'Bytt automatisk mellom kunder som trenger oppmerksomhet.': 'Automatically switch between customers that need attention.',
    'Rotasjon': 'Rotation',
    '15 sekunder': '15 seconds',
    '30 sekunder': '30 seconds',
    '60 sekunder': '60 seconds',
    'Om anbefalingene': 'About the recommendations',
    'Startvinduer er operative Cloud247-anbefalinger, ikke formelle frister fra Apple eller Microsoft. De er bevisst konservative for å gi tid til endringsvindu, kundekontakt og verifisering.': 'Start windows are operational Cloud247 recommendations, not formal deadlines from Apple or Microsoft. They are intentionally conservative to allow time for change windows, customer contact, and verification.',
    'Sikkerhet': 'Security',
    'Dashboardet bruker Microsoft Entra ID og OAuth authorization code flow med PKCE. Access- og refresh-token lagres bare i sessionStorage. Worker validerer signatur, issuer, tenant, audience, klient-app og scope før API-et svarer.': 'The dashboard uses Microsoft Entra ID and the OAuth authorization code flow with PKCE. Access and refresh tokens are stored only in sessionStorage. The Worker validates signature, issuer, tenant, audience, client app, and scope before the API responds.',
    'Lagre innstillinger': 'Save settings',
    'Bekreft': 'Confirm',
    'Fortsett': 'Continue',
    'Alle statuser': 'All statuses',
    'Søk kunde, navn, type, Apple ID…': 'Search customer, name, type, Apple ID…',
    'Legg til kunde': 'Add customer',
    'Søk': 'Search',
    '. Multi-tenant oversikt med Microsoft Graph, handlingsvinduer, live nedtelling og sikker kundeportal.': '. Multi-tenant overview with Microsoft Graph, action windows, live countdowns, and a secure customer portal.',
    'Kundeportal-innlogging er ikke konfigurert i config.js.': 'Customer portal sign-in is not configured in config.js.',
    'Management-innlogging er ikke konfigurert i config.js.': 'Management sign-in is not configured in config.js.',
    'Microsoft-innloggingen tok for lang tid. Prøv igjen.': 'Microsoft sign-in took too long. Please try again.',
    'Kunne ikke hente Microsoft access token': 'Could not retrieve Microsoft access token',
    'Velg innloggingstype.': 'Choose a sign-in type.',
    'Du er logget ut av ExpiryGuard.': 'You are signed out of ExpiryGuard.',
    'Microsoft-innlogging kreves': 'Microsoft sign-in required',
    'API er ikke konfigurert i config.js': 'The API is not configured in config.js',
    'Denne handlingen krever Cloud247 Admin': 'This action requires Cloud247 Admin',
    'Customer Viewer har kun lesetilgang': 'Customer Viewer has read-only access',
    'Legg til minst én kunde først': 'Add at least one customer first',
    'Kunne ikke lagre arbeidsstatus': 'Could not save work status',
    'Kunne ikke kopiere til utklippstavlen': 'Could not copy to the clipboard',
    'Kunden har godkjent Graph-consent. Logg inn med Cloud247 management-konto for å fullføre.': 'The customer has approved Graph consent. Sign in with the Cloud247 management account to complete the connection.',
    'Kunne ikke fullføre tenant-tilkoblingen': 'Could not complete the tenant connection',
    'Kunne ikke opprette consent-lenke': 'Could not create the consent link',
    'Kunne ikke lagre': 'Could not save',
    'Kunne ikke fjerne': 'Could not remove',
    'Kunne ikke importere filen': 'Could not import the file',
    'Microsoft-innloggingen ble avvist': 'Microsoft sign-in was rejected',
    'Kunne ikke hente data': 'Could not retrieve data',
    'Synkronisering feilet': 'Synchronization failed',
    'Kunne ikke starte management-innlogging': 'Could not start management sign-in',
    'Kunne ikke starte kundeinnlogging': 'Could not start customer sign-in',
    'Microsoft-innlogging feilet': 'Microsoft sign-in failed',
    'Fyll inn Microsoft auth-verdiene i config.js før du logger inn.': 'Enter the Microsoft auth values in config.js before signing in.',
    'Velg Cloud247 management eller kundeportal.': 'Choose Cloud247 management or customer portal.',
    'Kunne ikke validere frontend mot Worker.': 'Could not validate the frontend against the Worker.',
    'Microsoft-innloggingen kunne ikke valideres av Worker.': 'Microsoft sign-in could not be validated by the Worker.',
    'Fjerne kunde?': 'Remove customer?',
    'Slette element?': 'Delete item?',
    'Åpne': 'Open',
    'Rediger': 'Edit',
    'Slett': 'Delete',
    'Fjern': 'Remove',
    'aldri': 'never',
    'flere': 'more',
    'tiltak': 'actions',
    'elementer': 'items',
    'konsekvens': 'impact',
    'dager før': 'days before',
    'Henter data…': 'Loading data…',

    'Start fornyelse 1–2 måneder før utløp': 'Start renewal 1–2 months before expiration',
    'Apple MDM Push er en kritisk avhengighet. Start tidlig nok til å verifisere Apple-konto, riktig eksisterende sertifikat og et kontrollert endringsvindu.': 'Apple MDM Push is a critical dependency. Start early enough to verify the Apple account, the correct existing certificate, and a controlled change window.',
    'Microsoft oppgir at sertifikatet må fornyes årlig, og at Intune ikke kan administrere enheter som er registrert med sertifikatet når det er utløpt. Cloud247 bruker derfor 60 dager som operativ startgrense.': 'Microsoft states that the certificate must be renewed annually and that Intune cannot manage devices enrolled with the certificate after it expires. Cloud247 therefore uses 60 days as the operational start threshold.',
    'Bekreft Apple-kontoen, Topic/UID og hvilket eksisterende sertifikat som skal fornyes.': 'Confirm the Apple account, Topic/UID, and which existing certificate must be renewed.',
    'Last ned ny CSR fra Intune.': 'Download a new CSR from Intune.',
    'Forny det eksisterende sertifikatet i Apple Push Certificates Portal med samme Apple-konto. Ikke opprett et nytt sertifikat.': 'Renew the existing certificate in the Apple Push Certificates Portal using the same Apple account. Do not create a new certificate.',
    'Last opp det fornyede sertifikatet i Intune.': 'Upload the renewed certificate to Intune.',
    'Synkroniser ExpiryGuard og bekreft ny utløpsdato og aktiv status.': 'Synchronize ExpiryGuard and confirm the new expiration date and active status.',
    'Start fornyelse omtrent én måned før utløp': 'Start renewal about one month before expiration',
    'Apps & Books/VPP-token bør være ferdig fornyet før utløpsdagen slik at lisenskommunikasjon og appdistribusjon ikke stopper.': 'The Apps & Books/VPP token should be fully renewed before its expiration date so license communication and app distribution do not stop.',
    'Apple oppgir at content tokens blir ugyldige etter ett år, og at lisenskommunikasjonen stopper når tokenet er ugyldig. Cloud247 bruker 30 dager som operativ startgrense.': 'Apple states that content tokens become invalid after one year and license communication stops when the token is invalid. Cloud247 therefore uses 30 days as the operational start threshold.',
    'Bekreft riktig Apps & Books-lokasjon, organisasjon og Managed Apple Account.': 'Confirm the correct Apps & Books location, organization, and Managed Apple Account.',
    'Last ned et nytt content token fra Apple Business Manager eller Apple School Manager.': 'Download a new content token from Apple Business Manager or Apple School Manager.',
    'Oppdater det eksisterende VPP-tokenet i Intune – ikke opprett en parallell token for samme lokasjon.': 'Update the existing VPP token in Intune – do not create a parallel token for the same location.',
    'Kjør eller vent på VPP-synk og kontroller state/lastSyncStatus.': 'Run or wait for VPP synchronization and verify state/lastSyncStatus.',
    'Synkroniser ExpiryGuard og bekreft ny utløpsdato.': 'Synchronize ExpiryGuard and confirm the new expiration date.',
    'ADE-token bør fornyes i god tid før utløp slik at synk mellom Apple Business Manager og Intune ikke blir avbrutt.': 'The ADE token should be renewed well before expiration so synchronization between Apple Business Manager and Intune is not interrupted.',
    'Apple anbefaler å erstatte eksterne device-management service tokens godt før utløp. Microsoft oppgir at ADE-token fornyes årlig. Cloud247 bruker 30 dager som operativ startgrense.': 'Apple recommends replacing external device-management service tokens well before expiration. Microsoft states that the ADE token is renewed annually. Cloud247 therefore uses 30 days as the operational start threshold.',
    'Bekreft hvilket Apple Business Manager management service / MDM server tokenet tilhører.': 'Confirm which Apple Business Manager management service / MDM server the token belongs to.',
    'Planlegg å fullføre hele fornyelsen i samme endringsvindu.': 'Plan to complete the entire renewal within the same change window.',
    'Last ned nytt token fra Apple Business Manager når du er klar til å laste det opp i Intune.': 'Download a new token from Apple Business Manager when you are ready to upload it to Intune.',
    'Oppdater det eksisterende enrollment program-tokenet i Intune.': 'Update the existing enrollment program token in Intune.',
    'Synkroniser og kontroller ny utløpsdato, lastSuccessfulSyncDateTime og eventuelle synkfeil.': 'Synchronize and verify the new expiration date, lastSuccessfulSyncDateTime, and any synchronization errors.',
    'Start før du er avhengig av hastearbeid': 'Start before you depend on emergency work',
    'Planlegg fornyelsen før kritiskvinduet. Tilpass startgrensen etter hvor lang tid godkjenning, leverandørkontakt og testing vanligvis tar.': 'Plan the renewal before the critical window. Adjust the start threshold based on how long approvals, vendor contact, and testing usually take.',
    'Dette er en operativ Cloud247-anbefaling. For manuelle elementer bør du justere vinduet etter faktisk konsekvens og fornyelsesprosess.': 'This is an operational Cloud247 recommendation. For manual items, adjust the window based on the actual impact and renewal process.',
    'Bekreft eier og tilgang.': 'Confirm owner and access.',
    'Opprett eller oppdater ticket/endringssak.': 'Create or update the ticket/change record.',
    'Forny eller erstatt før kritiskvinduet.': 'Renew or replace before the critical window.',
    'Verifiser funksjon og oppdater utløpsdatoen i ExpiryGuard.': 'Verify functionality and update the expiration date in ExpiryGuard.',

    'Utløpt – håndter umiddelbart': 'Expired – handle immediately',
    'Kritisk – prioriter i dag': 'Critical – prioritize today',
    'Haster – bør allerede være i gang': 'Urgent – should already be in progress',
    'Anbefalt startvindu er åpnet': 'Recommended start window is open',
    'Synk-feil': 'Sync error',
    'Delvis synk': 'Partial sync',
    'Ikke synkronisert': 'Not synchronized',
    'Synk er eldre enn 12 t': 'Sync is older than 12 h',
    'Synkronisert': 'Synchronized',
    'Ingen elementer ennå.': 'No items yet.',
    'Ingen kunder lagt til.': 'No customers added.',
    'Ingen elementer': 'No items',
    'Logg inn med Microsoft': 'Sign in with Microsoft',
    'Ingen utløpsdatoer registrert for din tenant': 'No expiration dates are registered for your tenant',
    'Legg til en kunde eller manuelt element': 'Add a customer or manual item',
    'Microsoft-innlogging kreves': 'Microsoft sign-in required',
    'Ingen historikk ennå. Fornyelser registreres automatisk når en utløpsdato flyttes frem.': 'No history yet. Renewals are detected automatically when an expiration date moves forward.',
    'Ukjent': 'Unknown',
    'Manuell': 'Manual',
    'Fjernet': 'Removed',
    'Arbeidsstatus lagret': 'Work status saved',
    'Ticket-tekst kopiert': 'Ticket text copied',
    'Nettleseren støtter ikke varsler': 'This browser does not support notifications',
    'Browser-varsler er aktivert': 'Browser notifications are enabled',
    'Varsler ble ikke aktivert': 'Notifications were not enabled',
    '🔔 Varsler på': '🔔 Notifications on',
    '🔕 Varsler av': '🔕 Notifications off',
    'Bekrefter Graph-tilgang…': 'Confirming Graph access…',
    'Kunden er koblet til': 'Customer connected',
    'Fullskjerm støttes ikke i denne nettleseren': 'Full screen is not supported in this browser',
    '← Avslutt dashboard-modus': '← Exit dashboard mode',
    'Planvindu må være Start ≥ Haster ≥ Kritisk': 'Planning window must be Start ≥ Urgent ≥ Critical',
    'Element oppdatert': 'Item updated',
    'Element lagt til': 'Item added',
    'Microsoft-bruker': 'Microsoft user',
    'Ikke registrert': 'Not registered',
    'Foreslått sjekkliste:': 'Suggested checklist:',
    'Planstatus': 'Plan status',
    'Eier / Apple-konto': 'Owner / Apple account',
    'Kildestatus': 'Source status',
    'Sist oppdatert': 'Last updated',
    'Sist fornyet oppdaget': 'Last renewal detected',
    'Sertifikatserienummer': 'Certificate serial number',
    'Organisasjon': 'Organization',
    'VPP-kontotype': 'VPP account type',
    'Siste VPP-synk': 'Last VPP sync',
    'VPP-synkstatus': 'VPP sync status',
    'Land/region': 'Country/region',
    'Token-type': 'Token type',
    'Siste vellykkede ADE-synk': 'Last successful ADE sync',
    'ADE-synkfeil': 'ADE sync error',
    'Synkroniserte enheter': 'Synchronized devices',
    '🛡 Sikkerhetslogg': '🛡 Security log',
    'SIKKERHET': 'SECURITY',
    'Sikkerhetslogg': 'Security log',
    'Management-handlinger og endringer logges med bruker, tenant og tidspunkt.': 'Management actions and changes are logged with user, tenant, and timestamp.',
    '↻ Oppdater': '↻ Refresh',
    'Ingen loggoppføringer ennå.': 'No audit entries yet.',
    'Henter sikkerhetslogg…': 'Loading security log…',
    'Kunne ikke hente sikkerhetsloggen': 'Could not load the security log',
    'Administrasjonslenken må starte med https://': 'The administration link must use https://',
    'Importfilen kan være maks 1 MB': 'Import file can be at most 1 MB',
    'For mange forespørsler. Prøv igjen om litt.': 'Too many requests. Please try again shortly.',
    'Brukeren er ikke godkjent som ExpiryGuard management-bruker': 'The user is not approved as an ExpiryGuard management user',
    'Consent startet': 'Consent started',
    'Kunde koblet til': 'Customer connected',
    'Kunde fjernet': 'Customer removed',
    'Synkronisering startet': 'Synchronization started',
    'Planlagt synkronisering': 'Scheduled synchronization',
    'Manuelt element opprettet': 'Manual item created',
    'Manuelt element oppdatert': 'Manual item updated',
    'Manuelt element slettet': 'Manual item deleted',
    'Bulkimport gjennomført': 'Bulk import completed',
    'Arbeidsstatus oppdatert': 'Work status updated',
    'Avvist eller feilet endringsforsøk': 'Rejected or failed change request',
    'Ukjent handling': 'Unknown action',
    'Mål': 'Target'
  };

  const ATTR_EN = {
    'Cloud247 forside': 'Cloud247 home',
    'Legg til kunde': 'Add customer',
    'Søk': 'Search',
    'Filtrer status': 'Filter status',
    'Lukk': 'Close',
    'Søk kunde, navn, type, Apple ID…': 'Search customer, name, type, Apple ID…',
    'F.eks. SCEP Connector Certificate': 'E.g. SCEP Connector Certificate',
    'Ansvarlig / konto': 'Owner / account',
    'Fornyelsesrutine, ticket, kontaktperson…': 'Renewal procedure, ticket, contact person…',
    'Ticketnummer, hvem som jobber med saken, hva vi venter på…': 'Ticket number, who is working on it, what we are waiting for…'
  };

  function normalize(value) {
    const v = String(value || '').toLowerCase();
    return v.startsWith('en') ? 'en' : 'nb';
  }

  function initialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalize(saved);
    return normalize(navigator.languages?.[0] || navigator.language || 'nb');
  }

  let language = initialLanguage();

  function locale() { return language === 'en' ? 'en-GB' : 'nb-NO'; }
  function getLanguage() { return language; }

  function translateDynamic(text, lang = language) {
    const value = String(text ?? '');
    if (lang !== 'en' || !value) return value;
    if (Object.prototype.hasOwnProperty.call(EN, value)) return EN[value];

    const replacements = [
      [/^(\d+) dager før$/, '$1 days before'],
      [/^(\d+) dager$/, '$1 days'],
      [/^(\d+) elementer$/, '$1 items'],
      [/^(\d+) elementer importert$/, '$1 items imported'],
      [/^(\d+) tiltak$/, '$1 actions'],
      [/^(\d+) utløpt$/, '$1 expired'],
      [/^(\d+) kritisk$/, '$1 critical'],
      [/^(\d+) haster$/, '$1 urgent'],
      [/^(\d+) bør startes$/, '$1 should be started'],
      [/^Start om (.+)$/, 'Start in $1'],
      [/^Utløpt for (.+) siden$/, 'Expired $1 ago'],
      [/^Sist synkronisert (.+)$/, 'Last synchronized $1'],
      [/^Sist synk: (.+)$/, 'Last sync: $1'],
      [/^Synk ferdig: (\d+) OK, (\d+) feil$/, 'Sync complete: $1 OK, $2 failed'],
      [/^Synkroniserer kunde…$/, 'Synchronizing customer…'],
      [/^Synkroniserer alle kunder…$/, 'Synchronizing all customers…'],
      [/^Microsoft consent feilet: (.+)$/, 'Microsoft consent failed: $1'],
      [/^(\d+) krever oppmerksomhet$/, '$1 require attention'],
      [/^Datakvalitet:$/, 'Data quality:'],
      [/^\+([0-9]+) flere$/, '+$1 more'],
      [/^ny dato (.+)$/, 'new date $1'],
      [/^Start (.+) · Utløper (.+)$/, 'Start $1 · Expires $2'],
      [/^Start: (.+)$/, 'Start: $1'],
      [/^Utløp: (.+)$/, 'Expiration: $1'],
      [/^(Lav|Medium|Høy|Kritisk) konsekvens$/, (m, impact) => `${translateDynamic(impact, 'en')} impact`],
      [/^Kunde: (.+)$/, 'Customer: $1'],
      [/^Planstatus: (.+)$/, 'Plan status: $1'],
      [/^Konsekvens: (.+)$/, 'Impact: $1'],
      [/^Anbefalt start: (.+)$/, 'Recommended start: $1'],
      [/^Utløper: (.+)$/, 'Expires: $1'],
      [/^Tid igjen: (.+)$/, 'Time remaining: $1'],
      [/^Eier\/konto: (.+)$/, 'Owner/account: $1'],
      [/^Kundeportal · Customer Admin$/, 'Customer portal · Customer Admin'],
      [/^Kundeportal · Customer Viewer$/, 'Customer portal · Customer Viewer']
    ];
    for (const [pattern, replacement] of replacements) {
      if (pattern.test(value)) return value.replace(pattern, replacement);
    }
    return value;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    if (!textOrigins.has(node)) textOrigins.set(node, node.nodeValue);
    const original = textOrigins.get(node);
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const core = original.slice(leading.length, original.length - trailing.length || undefined);
    if (!core.trim()) return;
    const translated = translateDynamic(core, language);
    const next = `${leading}${translated}${trailing}`;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttributes(el) {
    if (!(el instanceof Element)) return;
    let originals = attrOrigins.get(el);
    if (!originals) { originals = {}; attrOrigins.set(el, originals); }
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      if (!el.hasAttribute(attr)) continue;
      if (!(attr in originals)) originals[attr] = el.getAttribute(attr);
      const original = originals[attr];
      const next = language === 'en' ? (ATTR_EN[original] || translateDynamic(original, 'en')) : original;
      if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
    }
  }

  function translateDom(root = document) {
    const start = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
    if (!start) return;
    if (start.nodeType === Node.TEXT_NODE) { translateTextNode(start); return; }
    translateAttributes(start);
    const walker = document.createTreeWalker(start, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateAttributes(node);
    }
    document.documentElement.lang = language;
    const mode = document.body?.dataset?.portalMode === 'customer' ? 'customer' : 'management';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', language === 'en'
      ? (mode === 'customer' ? 'Secure ExpiryGuard customer portal for expiration dates in your own Microsoft tenant.' : 'Multi-tenant ExpiryGuard management dashboard for Microsoft Intune expiration dates.')
      : (mode === 'customer' ? 'Sikker ExpiryGuard-kundeportal for utløpsdatoer i din egen Microsoft-tenant.' : 'Multi-tenant ExpiryGuard management-dashboard for utløpsdatoer fra Microsoft Intune.'));
    document.title = language === 'en'
      ? (mode === 'customer' ? 'ExpiryGuard Customer Portal | Cloud247' : 'ExpiryGuard Management | Cloud247')
      : (mode === 'customer' ? 'ExpiryGuard Kundeportal | Cloud247' : 'ExpiryGuard Management | Cloud247');
    updateSwitchers();
  }

  function updateSwitchers() {
    document.querySelectorAll('[data-language]').forEach(button => {
      const active = button.dataset.language === language;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setLanguage(next) {
    const normalized = normalize(next);
    if (normalized === language) { translateDom(document); return; }
    language = normalized;
    localStorage.setItem(STORAGE_KEY, language);
    translateDom(document);
    listeners.forEach(fn => { try { fn(language); } catch {} });
  }

  function onChange(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); }

  function bindSwitcher() {
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-language]');
      if (!button) return;
      setLanguage(button.dataset.language);
    });
  }

  function observe() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') mutation.addedNodes.forEach(node => translateDom(node));
        else if (mutation.type === 'characterData') translateTextNode(mutation.target);
        else if (mutation.type === 'attributes') translateAttributes(mutation.target);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  }

  window.ExpiryGuardI18n = {
    getLanguage,
    setLanguage,
    locale,
    text: translateDynamic,
    translateDom,
    onChange
  };

  bindSwitcher();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { translateDom(document); observe(); }, { once: true });
  } else {
    translateDom(document); observe();
  }
})();
