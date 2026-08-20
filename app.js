(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const cfg = window.EXPIRYGUARD_CONFIG || {};
  const API_BASE = String(cfg.apiBase || '').replace(/\/$/, '');
  const SETTINGS_KEY = 'cloud247-expiryguard-v4-settings';
  const NOTIFY_KEY = 'cloud247-expiryguard-v4-notify-state';
  const AUTH_KEY = 'cloud247-expiryguard-v4-auth';
  const PKCE_KEY = 'cloud247-expiryguard-v4-pkce';
  const authCfg = cfg.auth || {};
  const HOUR = 3600000;
  const DAY = 86400000;

  const SOURCE_POLICIES = {
    'graph-apns': {
      startDays: 60, urgentDays: 30, criticalDays: 14, impact: 'critical',
      title: 'Start fornyelse 1–2 måneder før utløp',
      recommendation: 'Apple MDM Push er en kritisk avhengighet. Start tidlig nok til å verifisere Apple-konto, riktig eksisterende sertifikat og et kontrollert endringsvindu.',
      rationale: 'Microsoft oppgir at sertifikatet må fornyes årlig, og at Intune ikke kan administrere enheter som er registrert med sertifikatet når det er utløpt. Cloud247 bruker derfor 60 dager som operativ startgrense.',
      steps: [
        'Bekreft Apple-kontoen, Topic/UID og hvilket eksisterende sertifikat som skal fornyes.',
        'Last ned ny CSR fra Intune.',
        'Forny det eksisterende sertifikatet i Apple Push Certificates Portal med samme Apple-konto. Ikke opprett et nytt sertifikat.',
        'Last opp det fornyede sertifikatet i Intune.',
        'Synkroniser ExpiryGuard og bekreft ny utløpsdato og aktiv status.'
      ],
      docsUrl: 'https://learn.microsoft.com/en-us/intune/device-enrollment/apple/create-mdm-push-certificate'
    },
    'graph-vpp': {
      startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'high',
      title: 'Start fornyelse omtrent én måned før utløp',
      recommendation: 'Apps & Books/VPP-token bør være ferdig fornyet før utløpsdagen slik at lisenskommunikasjon og appdistribusjon ikke stopper.',
      rationale: 'Apple oppgir at content tokens blir ugyldige etter ett år, og at lisenskommunikasjonen stopper når tokenet er ugyldig. Cloud247 bruker 30 dager som operativ startgrense.',
      steps: [
        'Bekreft riktig Apps & Books-lokasjon, organisasjon og Managed Apple Account.',
        'Last ned et nytt content token fra Apple Business Manager eller Apple School Manager.',
        'Oppdater det eksisterende VPP-tokenet i Intune – ikke opprett en parallell token for samme lokasjon.',
        'Kjør eller vent på VPP-synk og kontroller state/lastSyncStatus.',
        'Synkroniser ExpiryGuard og bekreft ny utløpsdato.'
      ],
      docsUrl: 'https://learn.microsoft.com/en-us/intune/apps/vpp-apps-ios'
    },
    'graph-ade': {
      startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'high',
      title: 'Start fornyelse omtrent én måned før utløp',
      recommendation: 'ADE-token bør fornyes i god tid før utløp slik at synk mellom Apple Business Manager og Intune ikke blir avbrutt.',
      rationale: 'Apple anbefaler å erstatte eksterne device-management service tokens godt før utløp. Microsoft oppgir at ADE-token fornyes årlig. Cloud247 bruker 30 dager som operativ startgrense.',
      steps: [
        'Bekreft hvilket Apple Business Manager management service / MDM server tokenet tilhører.',
        'Planlegg å fullføre hele fornyelsen i samme endringsvindu.',
        'Last ned nytt token fra Apple Business Manager når du er klar til å laste det opp i Intune.',
        'Oppdater det eksisterende enrollment program-tokenet i Intune.',
        'Synkroniser og kontroller ny utløpsdato, lastSuccessfulSyncDateTime og eventuelle synkfeil.'
      ],
      docsUrl: 'https://learn.microsoft.com/en-us/intune/device-enrollment/apple/manage-devices-tokens-apple'
    }
  };

  const MANUAL_POLICIES = {
    'TLS / SSL Certificate': { startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'high' },
    'SCEP / PKI Certificate': { startDays: 60, urgentDays: 30, criticalDays: 14, impact: 'high' },
    'API Token / Secret': { startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'high' },
    'Microsoft Entra App Secret / Certificate': { startDays: 60, urgentDays: 30, criticalDays: 14, impact: 'critical' },
    'Lisens / abonnement': { startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'medium' },
    'Apple / Intune annet': { startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'high' },
    'Egendefinert': { startDays: 30, urgentDays: 14, criticalDays: 7, impact: 'medium' }
  };

  const GENERIC_POLICY = {
    title: 'Start før du er avhengig av hastearbeid',
    recommendation: 'Planlegg fornyelsen før kritiskvinduet. Tilpass startgrensen etter hvor lang tid godkjenning, leverandørkontakt og testing vanligvis tar.',
    rationale: 'Dette er en operativ Cloud247-anbefaling. For manuelle elementer bør du justere vinduet etter faktisk konsekvens og fornyelsesprosess.',
    steps: ['Bekreft eier og tilgang.', 'Opprett eller oppdater ticket/endringssak.', 'Forny eller erstatt før kritiskvinduet.', 'Verifiser funksjon og oppdater utløpsdatoen i ExpiryGuard.'],
    docsUrl: ''
  };

  const els = {
    tenantList: $('tenantList'), allTenantCount: $('allTenantCount'), addTenant: $('addTenantButton'), manageTenants: $('manageTenantsButton'),
    tenantDialog: $('tenantDialog'), tenantForm: $('tenantForm'), tenantName: $('tenantName'), tenantId: $('tenantId'), cancelTenant: $('cancelTenant'),
    manageDialog: $('manageDialog'), manageTenantList: $('manageTenantList'),
    syncAll: $('syncAllButton'), notifications: $('notificationsButton'), fullscreen: $('fullscreenButton'), displayMode: $('displayModeButton'),
    addManual: $('addManualButton'), manualDialog: $('manualDialog'), manualForm: $('manualForm'), manualId: $('manualId'), manualTenant: $('manualTenant'), manualKind: $('manualKind'), manualName: $('manualName'), manualExpiry: $('manualExpiry'), manualReminder: $('manualReminder'), manualUrgent: $('manualUrgent'), manualCritical: $('manualCritical'), manualImpact: $('manualImpact'), manualOwner: $('manualOwner'), manualUrl: $('manualUrl'), manualNotes: $('manualNotes'), manualPolicyHint: $('manualPolicyHint'), cancelManual: $('cancelManual'),
    settings: $('settingsButton'), settingsDialog: $('settingsDialog'), settingsForm: $('settingsForm'), defaultReminder: $('defaultReminder'), notificationCadence: $('notificationCadence'), notifyEnabled: $('notifyEnabled'), rotateTenants: $('rotateTenants'), rotateSeconds: $('rotateSeconds'), cancelSettings: $('cancelSettings'),
    importFile: $('importFile'), exportJson: $('exportJsonButton'), exportCsv: $('exportCsvButton'), exportIcs: $('exportIcsButton'), search: $('searchInput'), filter: $('statusFilter'),
    statTotal: $('statTotal'), statPlanned: $('statPlanned'), statAction: $('statAction'), statUrgent: $('statUrgent'), statCritical: $('statCritical'), statExpired: $('statExpired'),
    overviewTitle: $('overviewTitle'), syncLine: $('syncLine'), displayMeta: $('displayMeta'), itemsBody: $('itemsBody'), tableWrap: $('tableWrap'), empty: $('emptyState'), dashboardGrid: $('dashboardGrid'),
    actionCard: $('actionCard'), actionQueue: $('actionQueue'), healthBanner: $('healthBanner'), activityList: $('activityList'),
    heroTitle: $('heroNextTitle'), heroTenant: $('heroNextTenant'), heroCountdown: $('heroCountdown'), heroRecommendation: $('heroRecommendation'), heroDot: $('heroStatusDot'),
    detailDialog: $('detailDialog'), detailTitle: $('detailTitle'), detailTenant: $('detailTenant'), detailSummary: $('detailSummary'), detailRecommendationTitle: $('detailRecommendationTitle'), detailRecommendation: $('detailRecommendation'), detailRunbook: $('detailRunbook'), detailMetadata: $('detailMetadata'), workflowButtons: $('workflowButtons'), workflowNote: $('workflowNote'), saveWorkflow: $('saveWorkflowButton'), copyTicket: $('copyTicketButton'), detailDocs: $('detailDocsLink'), detailAdmin: $('detailAdminLink'),
    confirm: $('confirmDialog'), confirmTitle: $('confirmTitle'), confirmText: $('confirmText'), toast: $('toast'),
    authGate: $('authGate'), appMain: $('appMain'), appFooter: $('appFooter'), signIn: $('signInButton'), signOut: $('signOutButton'), authStatus: $('authStatus'), authUser: $('authUser'), authAvatar: $('authAvatar'), authUserName: $('authUserName'), authUserAccount: $('authUserAccount')
  };

  let settings = loadSettings();
  let tenants = [];
  let items = [];
  let events = [];
  let selectedTenant = 'all';
  let pendingAction = null;
  let refreshing = false;
  let detailItemId = '';
  let detailSelectedWorkflow = 'not_started';
  let rotationTimer = null;
  let nextRotationAt = 0;

  function loadSettings() {
    const defaults = { defaultReminder: 30, notifyEnabled: false, notificationCadence: 12, rotateTenants: false, rotateSeconds: 30 };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
    catch { return defaults; }
  }
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function authSession() { try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  function setAuthSession(v) { if (v) sessionStorage.setItem(AUTH_KEY, JSON.stringify(v)); else sessionStorage.removeItem(AUTH_KEY); }
  function authConfigured() {
    return [authCfg.tenantId, authCfg.spaClientId, authCfg.apiClientId, authCfg.apiScope].every(v => v && !String(v).includes('YOUR_'));
  }
  function toast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => els.toast.classList.remove('show'), 2800); }
  function esc(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
  function randomBase64Url(bytes = 48) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return bytesToBase64Url(a); }
  function bytesToBase64Url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
  async function sha256Base64Url(value) { return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
  function redirectUri() { const local = ['localhost', '127.0.0.1'].includes(location.hostname); return String(local ? `${location.origin}${location.pathname}` : (cfg.appUrl || `${location.origin}${location.pathname}`)).replace(/#.*$/, ''); }
  function authScopes() { return ['openid', 'profile', 'email', 'offline_access', authCfg.apiScope].join(' '); }
  function tokenEndpoint() { return `https://login.microsoftonline.com/${encodeURIComponent(authCfg.tenantId)}/oauth2/v2.0/token`; }

  async function validateAuthConfiguration() {
    if (!authConfigured()) throw new Error('Microsoft-innlogging er ikke konfigurert i config.js.');
    if (!API_BASE || API_BASE.includes('YOUR-SUBDOMAIN')) throw new Error('Worker-URL er ikke konfigurert i config.js.');
    const response = await fetch(`${API_BASE}/api/config`, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Worker config-feil (${response.status})`);
    const pairs = [
      ['management tenant', authCfg.tenantId, data.authTenantId],
      ['Dashboard SPA client ID', authCfg.spaClientId, data.authSpaClientId],
      ['Dashboard API client ID', authCfg.apiClientId, data.authApiClientId],
      ['API scope', authCfg.apiScope, data.authScope]
    ];
    for (const [label, front, back] of pairs) if (String(front || '').toLowerCase() !== String(back || '').toLowerCase()) throw new Error(`Frontend og Worker har ulik ${label}.`);
    return data;
  }

  async function beginMicrosoftLogin() {
    try { await validateAuthConfiguration(); } catch (err) { setAuthStatus(err.message || 'Auth-konfigurasjonen er ugyldig.', true); return; }
    const verifier = randomBase64Url(64), state = randomBase64Url(32);
    const challenge = await sha256Base64Url(verifier);
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, createdAt: Date.now() }));
    const u = new URL(`https://login.microsoftonline.com/${encodeURIComponent(authCfg.tenantId)}/oauth2/v2.0/authorize`);
    u.searchParams.set('client_id', authCfg.spaClientId);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', redirectUri());
    u.searchParams.set('response_mode', 'query');
    u.searchParams.set('scope', authScopes());
    u.searchParams.set('code_challenge', challenge);
    u.searchParams.set('code_challenge_method', 'S256');
    u.searchParams.set('state', state);
    u.searchParams.set('prompt', 'select_account');
    location.assign(u.toString());
  }

  async function handleAuthCallback() {
    const p = new URLSearchParams(location.search);
    const storedRaw = sessionStorage.getItem(PKCE_KEY); if (!storedRaw) return false;
    let stored; try { stored = JSON.parse(storedRaw); } catch { sessionStorage.removeItem(PKCE_KEY); return false; }
    if (!p.get('state') || p.get('state') !== stored.state) return false;
    if (Date.now() - Number(stored.createdAt || 0) > 15 * 60 * 1000) { sessionStorage.removeItem(PKCE_KEY); throw new Error('Microsoft-innloggingen tok for lang tid. Prøv igjen.'); }
    if (p.get('error')) { sessionStorage.removeItem(PKCE_KEY); cleanAuthQuery(); throw new Error(p.get('error_description') || p.get('error')); }
    const code = p.get('code'); if (!code) return false;
    const body = new URLSearchParams({ client_id: authCfg.spaClientId, grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: stored.verifier, scope: authScopes() });
    const response = await fetch(tokenEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await response.json().catch(() => ({}));
    sessionStorage.removeItem(PKCE_KEY); cleanAuthQuery();
    if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Kunne ikke hente Microsoft access token');
    setAuthSession({ accessToken: data.access_token, refreshToken: data.refresh_token || '', expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 });
    return true;
  }

  function cleanAuthQuery() { history.replaceState({}, '', `${location.pathname}${location.hash}`); }
  async function refreshMicrosoftToken(force = false) {
    const current = authSession(); if (!current) return '';
    if (!force && current.accessToken && Number(current.expiresAt || 0) - Date.now() > 2 * 60 * 1000) return current.accessToken;
    if (!current.refreshToken) return '';
    const body = new URLSearchParams({ client_id: authCfg.spaClientId, grant_type: 'refresh_token', refresh_token: current.refreshToken, scope: authScopes() });
    const response = await fetch(tokenEndpoint(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) { setAuthSession(null); return ''; }
    setAuthSession({ accessToken: data.access_token, refreshToken: data.refresh_token || current.refreshToken, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 });
    return data.access_token;
  }
  async function accessToken() { return refreshMicrosoftToken(false); }
  function setAuthStatus(message, error = false) { els.authStatus.textContent = message; els.authStatus.classList.toggle('auth-error', error); }
  function showAuthGate(message = 'Ingen admin-token eller passord lagres i frontend.', error = false) { els.authGate.hidden = false; els.appMain.hidden = true; els.appFooter.hidden = true; els.authUser.hidden = true; setAuthStatus(message, error); }
  function showApp() { els.authGate.hidden = true; els.appMain.hidden = false; els.appFooter.hidden = false; }
  function signOutLocal() { setAuthSession(null); sessionStorage.removeItem(PKCE_KEY); tenants = []; items = []; events = []; showAuthGate('Du er logget ut av ExpiryGuard.'); }

  async function api(path, options = {}, retry = true) {
    if (!API_BASE || API_BASE.includes('YOUR-SUBDOMAIN')) throw new Error('API er ikke konfigurert i config.js');
    const token = await accessToken();
    if (!token) { signOutLocal(); const err = new Error('Microsoft-innlogging kreves'); err.status = 401; throw err; }
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (response.status === 401 && retry) {
      const fresh = await refreshMicrosoftToken(true);
      if (fresh) return api(path, options, false);
      signOutLocal();
    }
    if (!response.ok) { const err = new Error(data.error || data.message || `HTTP ${response.status}`); err.status = response.status; throw err; }
    return data;
  }

  function parseDate(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  function secondsUntil(v) { const d = parseDate(v); return d ? Math.floor((d.getTime() - Date.now()) / 1000) : Number.NEGATIVE_INFINITY; }
  function secondsLeft(v) { return secondsUntil(v); }
  function daysLeft(v) { return secondsLeft(v) / 86400; }
  function fmtDate(v, withTime = true) {
    const d = parseDate(v); if (!d) return '–';
    return new Intl.DateTimeFormat('nb-NO', withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
  function formatDuration(seconds, compact = false) {
    let s = Math.max(0, Math.floor(Math.abs(seconds)));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); const sec = s % 60;
    if (compact) {
      if (d > 0) return `${d} d ${h} t`;
      if (h > 0) return `${h} t ${m} min`;
      return `${m} min ${sec} sek`;
    }
    return d > 0 ? `${d} d ${String(h).padStart(2, '0')} t ${String(m).padStart(2, '0')} min` : `${String(h).padStart(2, '0')} t ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} sek`;
  }
  function formatRemaining(v) {
    const s = secondsLeft(v); if (!Number.isFinite(s)) return 'Ukjent';
    return s < 0 ? `Utløpt for ${formatDuration(s)} siden` : formatDuration(s);
  }
  function addDays(v, days) { const d = parseDate(v); return d ? new Date(d.getTime() + Number(days) * DAY).toISOString() : ''; }
  function recommendedStartAt(item) { return addDays(item.expiresAt, -policyFor(item).startDays); }

  function sourceLabel(source) {
    return ({ 'graph-apns': 'Graph · Apple Push', 'graph-ade': 'Graph · ADE', 'graph-vpp': 'Graph · VPP', 'manual': 'Manuell' })[source] || source || 'Ukjent';
  }
  function tenantById(id) { return tenants.find(t => t.id === id); }
  function tenantName(id) { return tenantById(id)?.displayName || id || 'Ukjent'; }
  function impactLabel(v) { return ({ low: 'Lav', medium: 'Medium', high: 'Høy', critical: 'Kritisk' })[v] || 'Medium'; }
  function workflowLabel(v) { return ({ not_started: 'Ikke startet', in_progress: 'Pågår', waiting: 'Venter', completed: 'Fornyet' })[v] || 'Ikke startet'; }
  function workflowClass(v) { return ({ not_started: 'not-started', in_progress: 'in-progress', waiting: 'waiting', completed: 'completed' })[v] || 'not-started'; }
  function stageLabel(v) { return ({ planned: 'Planlagt', action: 'Start nå', urgent: 'Haster', critical: 'Kritisk', expired: 'Utløpt' })[v] || v; }
  function stageRank(v) { return ({ expired: 0, critical: 1, urgent: 2, action: 3, planned: 4 })[v] ?? 5; }

  function policyFor(item) {
    const base = SOURCE_POLICIES[item.source] || { ...GENERIC_POLICY, ...(MANUAL_POLICIES[item.kind] || MANUAL_POLICIES.Egendefinert) };
    const startDays = Math.max(1, Number(item.reminderDays || base.startDays || settings.defaultReminder || 30));
    const urgentDays = Math.min(startDays, Math.max(1, Number(item.urgentDays || base.urgentDays || Math.min(14, startDays))));
    const criticalDays = Math.min(urgentDays, Math.max(1, Number(item.criticalDays || base.criticalDays || Math.min(7, urgentDays))));
    return { ...GENERIC_POLICY, ...base, startDays, urgentDays, criticalDays, impact: item.impact || base.impact || 'medium' };
  }

  function stageFor(item) {
    const p = policyFor(item);
    const days = daysLeft(item.expiresAt);
    let stage = days < 0 ? 'expired' : days <= p.criticalDays ? 'critical' : days <= p.urgentDays ? 'urgent' : days <= p.startDays ? 'action' : 'planned';
    if (item.source === 'graph-vpp') {
      const state = String(item.state || '').toLowerCase();
      if (state === 'expired') stage = 'expired';
      else if (['invalid', 'assignedtoexternalmdm'].includes(state) && stageRank('critical') < stageRank(stage)) stage = 'critical';
    }
    if (item.source === 'graph-ade' && Number(item.metadata?.lastSyncErrorCode || 0) !== 0 && stageRank('urgent') < stageRank(stage)) stage = 'urgent';
    return stage;
  }

  function actionText(item) {
    const stage = stageFor(item);
    if (stage === 'expired') return 'Utløpt – håndter umiddelbart';
    if (stage === 'critical') return 'Kritisk – prioriter i dag';
    if (stage === 'urgent') return 'Haster – bør allerede være i gang';
    if (stage === 'action') return 'Anbefalt startvindu er åpnet';
    const s = secondsUntil(recommendedStartAt(item));
    return s > 0 ? `Start om ${formatDuration(s, true)}` : 'Start nå';
  }

  function actionSort(a, b) {
    const sa = stageFor(a), sb = stageFor(b);
    const rank = stageRank(sa) - stageRank(sb);
    if (rank) return rank;
    const ia = ({ critical: 0, high: 1, medium: 2, low: 3 })[policyFor(a).impact] ?? 4;
    const ib = ({ critical: 0, high: 1, medium: 2, low: 3 })[policyFor(b).impact] ?? 4;
    if (ia !== ib) return ia - ib;
    const startRank = (parseDate(recommendedStartAt(a))?.getTime() || Infinity) - (parseDate(recommendedStartAt(b))?.getTime() || Infinity);
    if (startRank) return startRank;
    return (parseDate(a.expiresAt)?.getTime() || Infinity) - (parseDate(b.expiresAt)?.getTime() || Infinity);
  }

  function scopedItems() { return items.filter(i => selectedTenant === 'all' || i.tenantId === selectedTenant); }
  function visibleItems() {
    const q = els.search.value.trim().toLowerCase(), f = els.filter.value;
    return scopedItems().filter(i => {
      const hay = [tenantName(i.tenantId), i.name, i.kind, i.owner, i.source, i.notes, i.workflowNote, sourceLabel(i.source)].join(' ').toLowerCase();
      return (!q || hay.includes(q)) && (f === 'all' || stageFor(i) === f);
    }).sort(actionSort);
  }

  function tenantAttentionCount(tenantId) { return items.filter(i => i.tenantId === tenantId && stageFor(i) !== 'planned').length; }
  function tenantSyncHealth(t) {
    if (t.lastSyncStatus === 'error') return { level: 'error', text: 'Synk-feil' };
    if (t.lastSyncStatus === 'partial') return { level: 'warning', text: 'Delvis synk' };
    const d = parseDate(t.lastSyncAt);
    if (!d) return { level: 'warning', text: 'Ikke synkronisert' };
    if (Date.now() - d.getTime() > 12 * HOUR) return { level: 'warning', text: 'Synk er eldre enn 12 t' };
    return { level: 'ok', text: 'Synkronisert' };
  }

  function renderTenants() {
    els.allTenantCount.textContent = `${tenants.length} ${tenants.length === 1 ? 'tenant' : 'tenants'}`;
    els.tenantList.innerHTML = tenants.map(t => {
      const count = items.filter(i => i.tenantId === t.id).length;
      const attention = tenantAttentionCount(t.id);
      const health = tenantSyncHealth(t);
      return `<button class="tenant-choice ${selectedTenant === t.id ? 'active' : ''}" data-tenant="${esc(t.id)}" type="button"><span class="tenant-icon">${esc((t.displayName || '?').slice(0, 1).toUpperCase())}</span><span><strong>${esc(t.displayName)}</strong><small>${count} elementer${attention ? ` · ${attention} tiltak` : ''} · ${esc(health.text)}</small></span>${attention ? `<b class="tenant-alert">${attention}</b>` : ''}</button>`;
    }).join('');
    document.querySelector('[data-tenant="all"]')?.classList.toggle('active', selectedTenant === 'all');
    els.manualTenant.innerHTML = tenants.map(t => `<option value="${esc(t.id)}">${esc(t.displayName)}</option>`).join('');
    renderManageTenants();
  }

  function renderManageTenants() {
    els.manageTenantList.innerHTML = tenants.length ? tenants.map(t => {
      const attention = tenantAttentionCount(t.id);
      const health = tenantSyncHealth(t);
      return `<div class="manage-row" data-id="${esc(t.id)}"><div><strong>${esc(t.displayName)}</strong><small>${esc(t.id)}</small><small>${attention} tiltak · ${esc(health.text)} · Sist synk: ${t.lastSyncAt ? fmtDate(t.lastSyncAt) : 'aldri'}${t.lastSyncError ? ` · ${esc(t.lastSyncError)}` : ''}</small></div><div class="manage-actions"><button class="secondary-button sync-tenant" type="button">↻ Synk</button><button class="danger-button remove-tenant" type="button">Fjern</button></div></div>`;
    }).join('') : '<div class="empty-state"><p>Ingen kunder lagt til.</p></div>';
  }

  function renderHealth() {
    const scopeTenants = tenants.filter(t => selectedTenant === 'all' || t.id === selectedTenant);
    const issues = scopeTenants.map(t => ({ t, h: tenantSyncHealth(t) })).filter(x => x.h.level !== 'ok');
    if (!issues.length) { els.healthBanner.hidden = true; return; }
    els.healthBanner.hidden = false;
    els.healthBanner.innerHTML = `<strong>⚠ Datakvalitet:</strong> ${issues.slice(0, 4).map(x => `${esc(x.t.displayName)} – ${esc(x.h.text)}`).join(' · ')}${issues.length > 4 ? ` · +${issues.length - 4} flere` : ''}`;
  }

  function renderStats() {
    const counts = { planned: 0, action: 0, urgent: 0, critical: 0, expired: 0 };
    for (const i of scopedItems()) counts[stageFor(i)]++;
    els.statTotal.textContent = scopedItems().length;
    els.statPlanned.textContent = counts.planned;
    els.statAction.textContent = counts.action;
    els.statUrgent.textContent = counts.urgent;
    els.statCritical.textContent = counts.critical;
    els.statExpired.textContent = counts.expired;
  }

  function renderActionQueue() {
    const scoped = scopedItems().sort(actionSort);
    const attention = scoped.filter(i => stageFor(i) !== 'planned');
    const list = (attention.length ? attention : scoped).slice(0, 8);
    els.actionCard.classList.toggle('all-clear', attention.length === 0 && scoped.length > 0);
    if (!list.length) {
      els.actionQueue.innerHTML = '<div class="queue-empty">Ingen elementer ennå.</div>';
      return;
    }
    els.actionQueue.innerHTML = list.map(i => {
      const p = policyFor(i), stage = stageFor(i);
      const start = recommendedStartAt(i);
      return `<button class="queue-item ${stage}" data-detail-id="${esc(i.id)}" type="button"><span class="queue-status"><b>${esc(stageLabel(stage))}</b><small>${esc(impactLabel(p.impact))} konsekvens</small></span><span class="queue-main"><strong>${esc(i.name)}</strong><small>${esc(tenantName(i.tenantId))} · Start ${fmtDate(start, false)} · Utløper ${fmtDate(i.expiresAt, false)}</small></span><span class="queue-time">${esc(actionText(i))}</span><span class="queue-arrow">→</span></button>`;
    }).join('');
  }

  function renderItems() {
    const visible = visibleItems();
    els.empty.hidden = visible.length > 0;
    els.tableWrap.hidden = visible.length === 0 || document.body.classList.contains('display-mode');
    els.dashboardGrid.hidden = visible.length === 0;

    els.itemsBody.innerHTML = visible.map(i => {
      const stage = stageFor(i), p = policyFor(i), isManual = i.source === 'manual';
      return `<tr data-id="${esc(i.id)}"><td><span class="item-title">${esc(tenantName(i.tenantId))}</span></td><td><button class="link-button open-detail" type="button"><span class="item-title">${esc(i.name)}</span><span class="item-sub">${esc(sourceLabel(i.source))}${i.owner ? ` · ${esc(i.owner)}` : ''}</span></button></td><td><span class="item-title">${fmtDate(recommendedStartAt(i), false)}</span><span class="item-sub">${p.startDays} dager før</span></td><td>${fmtDate(i.expiresAt)}</td><td><span class="live-expiry countdown" data-item-id="${esc(i.id)}">${formatRemaining(i.expiresAt)}</span></td><td><span class="badge ${stage}">${stageLabel(stage)}</span><span class="item-sub">${esc(actionText(i))}</span></td><td><span class="workflow-badge ${workflowClass(i.workflowState)}">${esc(workflowLabel(i.workflowState))}</span></td><td><div class="row-actions"><button class="icon-button open-detail" type="button" title="Detaljer">→</button>${i.url ? `<a class="icon-button" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" title="Åpne">↗</a>` : ''}${isManual ? '<button class="icon-button edit-manual" type="button" title="Rediger">✎</button><button class="icon-button delete-manual" type="button" title="Slett">×</button>' : ''}</div></td></tr>`;
    }).join('');

    els.dashboardGrid.innerHTML = visible.slice(0, 32).map(i => {
      const stage = stageFor(i), p = policyFor(i);
      return `<button class="expiry-tile ${stage}" data-detail-id="${esc(i.id)}" type="button"><div class="expiry-tile-head"><small>${esc(tenantName(i.tenantId))}</small><span class="badge ${stage}">${stageLabel(stage)}</span></div><h3>${esc(i.name)}</h3><small>${esc(sourceLabel(i.source))}</small><div class="tile-plan"><span>Start: <b>${fmtDate(recommendedStartAt(i), false)}</b></span><span>Utløp: <b>${fmtDate(i.expiresAt, false)}</b></span></div><div class="live-expiry countdown" data-item-id="${esc(i.id)}">${formatRemaining(i.expiresAt)}</div><div class="tile-footer"><span>${esc(impactLabel(p.impact))} konsekvens</span><span class="workflow-badge ${workflowClass(i.workflowState)}">${esc(workflowLabel(i.workflowState))}</span></div></button>`;
    }).join('');

    els.overviewTitle.textContent = selectedTenant === 'all' ? 'Alle kunder' : tenantName(selectedTenant);
    const syncDates = tenants.filter(t => selectedTenant === 'all' || t.id === selectedTenant).map(t => parseDate(t.lastSyncAt)).filter(Boolean).sort((a, b) => b - a);
    els.syncLine.textContent = syncDates[0] ? `Sist synkronisert ${fmtDate(syncDates[0].toISOString())}` : 'Ikke synkronisert ennå';
    renderStats();
    renderActionQueue();
    renderHealth();
    renderHero();
    renderActivity();
  }

  function renderHero() {
    const scoped = scopedItems().sort(actionSort);
    const next = scoped[0];
    if (!next) {
      els.heroTitle.textContent = authSession() ? 'Ingen elementer' : 'Logg inn med Microsoft';
      els.heroTenant.textContent = authSession() ? 'Legg til en kunde eller manuelt element' : 'Management-innlogging kreves';
      els.heroCountdown.textContent = '–';
      els.heroRecommendation.textContent = '–';
      els.heroCountdown.removeAttribute('data-item-id');
      els.heroDot.className = 'status-dot';
      return;
    }
    const stage = stageFor(next), p = policyFor(next);
    els.heroTitle.textContent = next.name;
    els.heroTenant.textContent = tenantName(next.tenantId);
    els.heroCountdown.dataset.itemId = next.id;
    els.heroCountdown.textContent = heroTiming(next);
    els.heroRecommendation.textContent = `${stageLabel(stage)} · Start ${fmtDate(recommendedStartAt(next), false)} · Utløper ${fmtDate(next.expiresAt, false)} · ${impactLabel(p.impact)} konsekvens`;
    els.heroDot.className = `status-dot ${stage}`;
  }

  function heroTiming(item) {
    const stage = stageFor(item);
    if (stage === 'planned') return `Start om ${formatDuration(secondsUntil(recommendedStartAt(item)), true)}`;
    return formatRemaining(item.expiresAt);
  }

  function renderActivity() {
    const list = events.filter(e => selectedTenant === 'all' || e.tenantId === selectedTenant).slice(0, 8);
    if (!list.length) { els.activityList.innerHTML = '<div class="queue-empty">Ingen historikk ennå. Fornyelser registreres automatisk når en utløpsdato flyttes frem.</div>'; return; }
    els.activityList.innerHTML = list.map(e => `<div class="activity-row"><span class="activity-icon">${e.eventType === 'renewal_detected' ? '✓' : e.eventType === 'workflow_changed' ? '↻' : '•'}</span><span><strong>${esc(e.message || e.eventType)}</strong><small>${esc(tenantName(e.tenantId))} · ${fmtDate(e.createdAt)}${e.newExpiresAt ? ` · ny dato ${fmtDate(e.newExpiresAt, false)}` : ''}</small></span></div>`).join('');
  }

  function render() { renderTenants(); renderItems(); updateLiveText(); updateNotificationButton(); updateDisplayMeta(); }

  function updateLiveText() {
    document.querySelectorAll('.live-expiry[data-item-id]').forEach(el => {
      const item = items.find(i => i.id === el.dataset.itemId); if (item) el.textContent = formatRemaining(item.expiresAt);
    });
    const heroId = els.heroCountdown.dataset.itemId;
    const heroItem = items.find(i => i.id === heroId);
    if (heroItem) els.heroCountdown.textContent = heroTiming(heroItem);
    if (els.detailDialog.open && detailItemId) {
      const item = items.find(i => i.id === detailItemId);
      const live = els.detailSummary.querySelector('.detail-live');
      if (item && live) live.textContent = formatRemaining(item.expiresAt);
    }
    updateDisplayMeta();
  }

  function updateDisplayMeta() {
    const now = new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    if (!document.body.classList.contains('display-mode')) { els.displayMeta.textContent = ''; return; }
    let extra = '';
    if (settings.rotateTenants && nextRotationAt > Date.now()) extra = ` · neste kunde om ${Math.ceil((nextRotationAt - Date.now()) / 1000)} sek`;
    els.displayMeta.textContent = `${now}${extra}`;
  }

  async function refresh({ quiet = false } = {}) {
    if (refreshing) return;
    if (!authSession()) { render(); if (!quiet) toast('Logg inn med Microsoft først'); return; }
    refreshing = true; if (!quiet) els.syncLine.textContent = 'Henter data…';
    try {
      const [t, i] = await Promise.all([api('/api/tenants'), api('/api/items')]);
      tenants = t.tenants || []; items = i.items || [];
      try { const e = await api('/api/events?limit=100'); events = e.events || []; } catch { events = []; }
      if (selectedTenant !== 'all' && !tenants.some(x => x.id === selectedTenant)) selectedTenant = 'all';
      render();
      await checkNotifications();
      startRotation();
    } catch (err) {
      if (err.status === 401 || err.status === 403) { signOutLocal(); toast(err.message || 'Microsoft-innloggingen ble avvist'); }
      else toast(err.message || 'Kunne ikke hente data');
    } finally { refreshing = false; }
  }

  async function sync(tenantId = null) {
    if (!ensureAdmin()) return;
    toast(tenantId ? 'Synkroniserer kunde…' : 'Synkroniserer alle kunder…');
    try {
      const result = await api('/api/sync', { method: 'POST', body: JSON.stringify(tenantId ? { tenantId } : {}) });
      toast(`Synk ferdig: ${result.ok || 0} OK, ${result.failed || 0} feil`);
      await refresh({ quiet: true });
    } catch (err) { toast(err.message || 'Synkronisering feilet'); }
  }

  function ensureAdmin() { if (authSession()) return true; showAuthGate('Logg inn med Microsoft for å fortsette.'); toast('Microsoft-innlogging kreves'); return false; }
  function openSettings() {
    els.defaultReminder.value = String(settings.defaultReminder || 30);
    els.notificationCadence.value = String(settings.notificationCadence || 12);
    els.notifyEnabled.checked = !!settings.notifyEnabled;
    els.rotateTenants.checked = !!settings.rotateTenants;
    els.rotateSeconds.value = String(settings.rotateSeconds || 30);
    els.settingsDialog.showModal();
  }

  function manualDefaults(kind) { return MANUAL_POLICIES[kind] || { startDays: Number(settings.defaultReminder || 30), urgentDays: 14, criticalDays: 7, impact: 'medium' }; }
  function applyManualPolicyDefaults() {
    const p = manualDefaults(els.manualKind.value);
    els.manualReminder.value = p.startDays;
    els.manualUrgent.value = p.urgentDays;
    els.manualCritical.value = p.criticalDays;
    els.manualImpact.value = p.impact;
    updateManualPolicyHint();
  }
  function updateManualPolicyHint() {
    const start = Number(els.manualReminder.value || 30), urgent = Number(els.manualUrgent.value || 14), critical = Number(els.manualCritical.value || 7);
    els.manualPolicyHint.innerHTML = `<strong>Plan:</strong><p>Start ${start} dager før · Haster fra ${urgent} dager · Kritisk fra ${critical} dager før utløp. Dette kan tilpasses per element.</p>`;
  }
  function openManual(item = null) {
    if (!ensureAdmin()) return;
    if (!tenants.length) { toast('Legg til minst én kunde først'); return; }
    els.manualForm.reset();
    els.manualId.value = item?.id || '';
    els.manualTenant.value = item?.tenantId || (selectedTenant !== 'all' ? selectedTenant : tenants[0].id);
    els.manualKind.value = item?.kind || 'Egendefinert';
    els.manualName.value = item?.name || '';
    els.manualOwner.value = item?.owner || '';
    els.manualUrl.value = item?.url || '';
    els.manualNotes.value = item?.notes || '';
    if (item) {
      els.manualReminder.value = String(item.reminderDays || 30);
      els.manualUrgent.value = String(item.urgentDays || 14);
      els.manualCritical.value = String(item.criticalDays || 7);
      els.manualImpact.value = item.impact || 'medium';
    } else applyManualPolicyDefaults();
    if (item?.expiresAt) { const d = new Date(item.expiresAt); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); els.manualExpiry.value = local; } else els.manualExpiry.value = '';
    $('manualEyebrow').textContent = item ? 'REDIGER MANUELT ELEMENT' : 'MANUELT ELEMENT';
    $('manualTitle').textContent = item ? 'Rediger utløpsdato' : 'Legg til utløpsdato';
    updateManualPolicyHint();
    els.manualDialog.showModal();
  }

  function openDetail(itemOrId) {
    const item = typeof itemOrId === 'string' ? items.find(i => i.id === itemOrId) : itemOrId;
    if (!item) return;
    detailItemId = item.id;
    detailSelectedWorkflow = item.workflowState || 'not_started';
    const p = policyFor(item), stage = stageFor(item);
    els.detailTitle.textContent = item.name;
    els.detailTenant.textContent = `${tenantName(item.tenantId)} · ${sourceLabel(item.source)}`;
    els.detailSummary.innerHTML = `<div><span>Planstatus</span><strong><span class="badge ${stage}">${stageLabel(stage)}</span></strong></div><div><span>Anbefalt start</span><strong>${fmtDate(recommendedStartAt(item))}</strong><small>${p.startDays} dager før utløp</small></div><div><span>Utløper</span><strong>${fmtDate(item.expiresAt)}</strong><small class="detail-live countdown">${formatRemaining(item.expiresAt)}</small></div><div><span>Konsekvens</span><strong>${impactLabel(p.impact)}</strong><small>${actionText(item)}</small></div>`;
    els.detailRecommendationTitle.textContent = p.title;
    els.detailRecommendation.innerHTML = `${esc(p.recommendation)}<br><br><small>${esc(p.rationale)}</small>`;
    els.detailRunbook.innerHTML = `<ol>${p.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
    els.workflowNote.value = item.workflowNote || '';
    renderWorkflowButtons();
    const meta = { 'Eier / Apple-konto': item.owner || '', 'Kildestatus': item.state || '', 'Sist oppdatert': fmtDate(item.updatedAt), 'Sist fornyet oppdaget': item.lastRenewedAt ? fmtDate(item.lastRenewedAt) : '', ...friendlyMetadata(item.metadata) };
    els.detailMetadata.innerHTML = Object.entries(meta).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(String(v))}</strong></div>`).join('');
    if (p.docsUrl) { els.detailDocs.hidden = false; els.detailDocs.href = p.docsUrl; } else { els.detailDocs.hidden = true; els.detailDocs.removeAttribute('href'); }
    if (item.url) { els.detailAdmin.hidden = false; els.detailAdmin.href = item.url; } else { els.detailAdmin.hidden = true; els.detailAdmin.removeAttribute('href'); }
    if (!els.detailDialog.open) els.detailDialog.showModal();
  }

  function friendlyMetadata(metadata = {}) {
    const out = {};
    const map = {
      appleIdentifier: 'Apple ID', topicIdentifier: 'Topic ID', certificateSerialNumber: 'Sertifikatserienummer', organizationName: 'Organisasjon', vppTokenAccountType: 'VPP-kontotype', lastSyncDateTime: 'Siste VPP-synk', lastSyncStatus: 'VPP-synkstatus', countryOrRegion: 'Land/region', lastAppCount: 'Antall apper', tokenName: 'ADE-token', tokenType: 'Token-type', lastSuccessfulSyncDateTime: 'Siste vellykkede ADE-synk', lastSyncErrorCode: 'ADE-synkfeil', syncedDeviceCount: 'Synkroniserte enheter'
    };
    for (const [key, label] of Object.entries(map)) {
      let value = metadata[key];
      if (value === '' || value === null || value === undefined) continue;
      if (/DateTime$/.test(key) && parseDate(value)) value = fmtDate(value);
      out[label] = value;
    }
    return out;
  }

  function renderWorkflowButtons() {
    els.workflowButtons.querySelectorAll('[data-workflow]').forEach(b => b.classList.toggle('active', b.dataset.workflow === detailSelectedWorkflow));
  }

  async function saveWorkflow() {
    const item = items.find(i => i.id === detailItemId); if (!item) return;
    try {
      await api(`/api/items/${encodeURIComponent(item.id)}/workflow`, { method: 'PATCH', body: JSON.stringify({ workflowState: detailSelectedWorkflow, workflowNote: els.workflowNote.value.trim() }) });
      toast('Arbeidsstatus lagret');
      await refresh({ quiet: true });
      const updated = items.find(i => i.id === detailItemId); if (updated) openDetail(updated);
    } catch (err) { toast(err.message || 'Kunne ikke lagre arbeidsstatus'); }
  }

  function ticketText(item) {
    const p = policyFor(item), stage = stageFor(item);
    return [
      `ExpiryGuard – ${item.name}`,
      `Kunde: ${tenantName(item.tenantId)}`,
      `Planstatus: ${stageLabel(stage)}`,
      `Konsekvens: ${impactLabel(p.impact)}`,
      `Anbefalt start: ${fmtDate(recommendedStartAt(item))}`,
      `Utløper: ${fmtDate(item.expiresAt)}`,
      `Tid igjen: ${formatRemaining(item.expiresAt)}`,
      `Eier/konto: ${item.owner || 'Ikke registrert'}`,
      '',
      p.title,
      p.recommendation,
      '',
      'Foreslått sjekkliste:',
      ...p.steps.map((s, n) => `${n + 1}. ${s}`)
    ].join('\n');
  }

  async function copyTicket() {
    const item = items.find(i => i.id === detailItemId); if (!item) return;
    try { await navigator.clipboard.writeText(ticketText(item)); toast('Ticket-tekst kopiert'); }
    catch { toast('Kunne ikke kopiere til utklippstavlen'); }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) { toast('Nettleseren støtter ikke varsler'); return false; }
    const permission = await Notification.requestPermission();
    settings.notifyEnabled = permission === 'granted';
    saveSettings(); updateNotificationButton();
    if (permission === 'granted') { toast('Browser-varsler er aktivert'); await checkNotifications(true); return true; }
    toast('Varsler ble ikke aktivert'); return false;
  }
  function updateNotificationButton() {
    const granted = ('Notification' in window) && Notification.permission === 'granted' && settings.notifyEnabled;
    els.notifications.textContent = granted ? '🔔 Varsler på' : '🔕 Varsler av';
  }
  async function checkNotifications(force = false) {
    if (!settings.notifyEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now();
    const attention = items.filter(i => {
      const stage = stageFor(i);
      if (stage === 'planned') return false;
      if (i.workflowState === 'completed' && i.workflowUpdatedAt && now - new Date(i.workflowUpdatedAt).getTime() < 24 * HOUR) return false;
      return true;
    });
    if (!attention.length) return;
    const counts = { expired: 0, critical: 0, urgent: 0, action: 0 };
    attention.forEach(i => counts[stageFor(i)]++);
    const signature = attention.map(i => `${i.id}:${stageFor(i)}:${i.workflowState}`).sort().join('|');
    let prev = {}; try { prev = JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}'); } catch {}
    const cadence = Math.max(6, Number(settings.notificationCadence || 12)) * HOUR;
    if (!force && prev.signature === signature && now - Number(prev.at || 0) < cadence) return;
    const parts = [];
    if (counts.expired) parts.push(`${counts.expired} utløpt`);
    if (counts.critical) parts.push(`${counts.critical} kritisk`);
    if (counts.urgent) parts.push(`${counts.urgent} haster`);
    if (counts.action) parts.push(`${counts.action} bør startes`);
    const title = `ExpiryGuard: ${attention.length} krever oppmerksomhet`;
    const options = { body: parts.join(' · '), icon: 'assets/cloud247-mark.svg', badge: 'assets/cloud247-mark.svg', tag: 'expiryguard-summary', renotify: true, data: { url: './' } };
    try { const reg = await navigator.serviceWorker?.ready; if (reg) await reg.showNotification(title, options); else new Notification(title, options); } catch { try { new Notification(title, options); } catch {} }
    localStorage.setItem(NOTIFY_KEY, JSON.stringify({ signature, at: now }));
  }

  function startRotation() {
    clearInterval(rotationTimer); rotationTimer = null; nextRotationAt = 0;
    if (!settings.rotateTenants || !document.body.classList.contains('display-mode') || tenants.length < 2) return;
    const seconds = Math.max(15, Number(settings.rotateSeconds || 30));
    const rotate = () => {
      const attentionIds = tenants.filter(t => tenantAttentionCount(t.id) > 0).map(t => t.id);
      const targets = attentionIds.length ? attentionIds : tenants.map(t => t.id);
      if (!targets.length) return;
      const currentIndex = targets.indexOf(selectedTenant);
      selectedTenant = targets[(currentIndex + 1 + targets.length) % targets.length];
      render();
      nextRotationAt = Date.now() + seconds * 1000;
    };
    nextRotationAt = Date.now() + seconds * 1000;
    rotationTimer = setInterval(rotate, seconds * 1000);
  }

  async function handleConsentCallback() {
    const p = new URLSearchParams(location.search);
    const expectedState = sessionStorage.getItem('expiryguard-consent-state') || '';
    const isConsentReturn = p.has('admin_consent') || (!!expectedState && p.get('state') === expectedState);
    if (!isConsentReturn) return;
    if (p.get('error')) { sessionStorage.removeItem('expiryguard-consent-state'); toast(`Microsoft consent feilet: ${p.get('error_description') || p.get('error')}`); history.replaceState({}, '', location.pathname + location.hash); return; }
    const tenantId = p.get('tenant'), state = p.get('state'); if (!tenantId || !state) return;
    sessionStorage.setItem('expiryguard-pending-consent', JSON.stringify({ tenantId, state }));
    sessionStorage.removeItem('expiryguard-consent-state');
    history.replaceState({}, '', location.pathname + location.hash);
    await finalizePendingConsent();
  }
  async function finalizePendingConsent() {
    const raw = sessionStorage.getItem('expiryguard-pending-consent'); if (!raw) return;
    if (!authSession()) { showAuthGate('Kunden har godkjent consent. Logg inn med management-konto for å fullføre.'); return; }
    try {
      const pending = JSON.parse(raw); toast('Bekrefter Graph-tilgang…');
      await api('/api/tenants/confirm', { method: 'POST', body: JSON.stringify(pending) });
      sessionStorage.removeItem('expiryguard-pending-consent'); toast('Kunden er koblet til');
      await refresh({ quiet: true }); await sync(pending.tenantId);
    } catch (err) { toast(err.message || 'Kunne ikke fullføre tenant-tilkoblingen'); }
  }


  function icsEscape(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function icsDate(v) { const d = parseDate(v); return d ? d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : ''; }
  function exportCalendar() {
    const now = icsDate(new Date().toISOString());
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cloud247//ExpiryGuard v4//NO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Cloud247 ExpiryGuard'];
    for (const item of items) {
      const p = policyFor(item);
      const tenant = tenantName(item.tenantId);
      const startAt = recommendedStartAt(item);
      const desc = `Kunde: ${tenant}\nKonsekvens: ${impactLabel(p.impact)}\nUtløper: ${fmtDate(item.expiresAt)}\n${p.recommendation}`;
      lines.push('BEGIN:VEVENT', `UID:${icsEscape(item.id)}-start@expiryguard.cloud247.no`, `DTSTAMP:${now}`, `DTSTART:${icsDate(startAt)}`, `SUMMARY:${icsEscape(`ExpiryGuard: Start fornyelse – ${item.name}`)}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
      lines.push('BEGIN:VEVENT', `UID:${icsEscape(item.id)}-expiry@expiryguard.cloud247.no`, `DTSTAMP:${now}`, `DTSTART:${icsDate(item.expiresAt)}`, `SUMMARY:${icsEscape(`ExpiryGuard: UTLØPER – ${item.name}`)}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    download(`expiryguard-v4-${new Date().toISOString().slice(0, 10)}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  function download(name, text, type) { const blob = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i], n = text[i + 1]; if (q && c === '"' && n === '"') { cell += '"'; i++; } else if (c === '"') q = !q; else if (c === ',' && !q) { row.push(cell); cell = ''; } else if ((c === '\n' || c === '\r') && !q) { if (c === '\r' && n === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; } else cell += c; }
    row.push(cell); if (row.some(x => x.trim())) rows.push(row); if (rows.length < 2) return [];
    const h = rows[0].map(x => x.trim()); return rows.slice(1).map(r => Object.fromEntries(h.map((k, j) => [k, r[j] ?? ''])));
  }

  els.tenantList.addEventListener('click', e => { const b = e.target.closest('[data-tenant]'); if (!b) return; selectedTenant = b.dataset.tenant; render(); startRotation(); });
  document.querySelector('[data-tenant="all"]')?.addEventListener('click', () => { selectedTenant = 'all'; render(); startRotation(); });
  els.addTenant.addEventListener('click', () => { if (!ensureAdmin()) return; els.tenantForm.reset(); els.tenantDialog.showModal(); });
  els.manageTenants.addEventListener('click', () => { if (!ensureAdmin()) return; renderManageTenants(); els.manageDialog.showModal(); });
  els.cancelTenant.addEventListener('click', () => els.tenantDialog.close());
  els.tenantForm.addEventListener('submit', async e => { e.preventDefault(); try { const result = await api('/api/tenants/consent', { method: 'POST', body: JSON.stringify({ tenantId: els.tenantId.value.trim(), displayName: els.tenantName.value.trim() }) }); sessionStorage.setItem('expiryguard-consent-state', result.state || ''); location.href = result.consentUrl; } catch (err) { toast(err.message || 'Kunne ikke opprette consent-lenke'); } });
  els.manageTenantList.addEventListener('click', async e => { const row = e.target.closest('.manage-row'); if (!row) return; const id = row.dataset.id; if (e.target.closest('.sync-tenant')) await sync(id); if (e.target.closest('.remove-tenant')) { const t = tenantById(id); pendingAction = { type: 'removeTenant', id }; els.confirmTitle.textContent = 'Fjerne kunde?'; els.confirmText.textContent = `${t?.displayName || id} og lagrede ExpiryGuard-data for kunden fjernes. Admin consent i kundens tenant påvirkes ikke.`; els.confirm.showModal(); } });
  els.syncAll.addEventListener('click', () => sync());
  els.notifications.addEventListener('click', requestNotifications);
  els.fullscreen.addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { toast('Fullskjerm støttes ikke i denne nettleseren'); } });
  els.displayMode.addEventListener('click', () => { document.body.classList.toggle('display-mode'); els.displayMode.textContent = document.body.classList.contains('display-mode') ? '← Avslutt dashboard-modus' : '◫ Dashboard-modus'; renderItems(); startRotation(); });
  els.settings.addEventListener('click', openSettings); els.cancelSettings.addEventListener('click', () => els.settingsDialog.close());
  els.settingsForm.addEventListener('submit', async e => {
    e.preventDefault(); settings.defaultReminder = Number(els.defaultReminder.value || 30); settings.notificationCadence = Number(els.notificationCadence.value || 12); settings.rotateTenants = els.rotateTenants.checked; settings.rotateSeconds = Number(els.rotateSeconds.value || 30); const wants = els.notifyEnabled.checked; saveSettings(); els.settingsDialog.close();
    if (wants && (!('Notification' in window) || Notification.permission !== 'granted')) await requestNotifications(); else { settings.notifyEnabled = wants; saveSettings(); }
    await finalizePendingConsent(); await refresh({ quiet: true }); startRotation();
  });

  els.addManual.addEventListener('click', () => openManual()); els.cancelManual.addEventListener('click', () => els.manualDialog.close());
  els.manualKind.addEventListener('change', applyManualPolicyDefaults);
  [els.manualReminder, els.manualUrgent, els.manualCritical].forEach(el => el.addEventListener('input', updateManualPolicyHint));
  els.manualForm.addEventListener('submit', async e => {
    e.preventDefault();
    const id = els.manualId.value;
    const start = Number(els.manualReminder.value), urgent = Number(els.manualUrgent.value), critical = Number(els.manualCritical.value);
    if (!(start >= urgent && urgent >= critical && critical >= 1)) { toast('Planvindu må være Start ≥ Haster ≥ Kritisk'); return; }
    const payload = { tenantId: els.manualTenant.value, kind: els.manualKind.value, name: els.manualName.value.trim(), expiresAt: new Date(els.manualExpiry.value).toISOString(), reminderDays: start, urgentDays: urgent, criticalDays: critical, impact: els.manualImpact.value, owner: els.manualOwner.value.trim(), url: els.manualUrl.value.trim(), notes: els.manualNotes.value.trim() };
    try { await api(id ? `/api/manual/${encodeURIComponent(id)}` : '/api/manual', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); els.manualDialog.close(); toast(id ? 'Element oppdatert' : 'Element lagt til'); await refresh({ quiet: true }); } catch (err) { toast(err.message || 'Kunne ikke lagre'); }
  });

  els.itemsBody.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return; const item = items.find(i => i.id === tr.dataset.id); if (!item) return;
    if (e.target.closest('.open-detail')) openDetail(item);
    if (e.target.closest('.edit-manual')) openManual(item);
    if (e.target.closest('.delete-manual')) { pendingAction = { type: 'deleteManual', id: item.id }; els.confirmTitle.textContent = 'Slette element?'; els.confirmText.textContent = `${item.name} fjernes fra ExpiryGuard.`; els.confirm.showModal(); }
  });
  els.dashboardGrid.addEventListener('click', e => { const b = e.target.closest('[data-detail-id]'); if (b) openDetail(b.dataset.detailId); });
  els.actionQueue.addEventListener('click', e => { const b = e.target.closest('[data-detail-id]'); if (b) openDetail(b.dataset.detailId); });
  els.workflowButtons.addEventListener('click', e => { const b = e.target.closest('[data-workflow]'); if (!b) return; detailSelectedWorkflow = b.dataset.workflow; renderWorkflowButtons(); });
  els.saveWorkflow.addEventListener('click', saveWorkflow);
  els.copyTicket.addEventListener('click', copyTicket);

  els.confirm.addEventListener('close', async () => {
    if (els.confirm.returnValue !== 'confirm' || !pendingAction) { pendingAction = null; return; }
    try {
      if (pendingAction.type === 'removeTenant') await api(`/api/tenants/${encodeURIComponent(pendingAction.id)}`, { method: 'DELETE' });
      if (pendingAction.type === 'deleteManual') await api(`/api/manual/${encodeURIComponent(pendingAction.id)}`, { method: 'DELETE' });
      toast('Fjernet'); await refresh({ quiet: true });
    } catch (err) { toast(err.message || 'Kunne ikke fjerne'); } finally { pendingAction = null; }
  });

  els.search.addEventListener('input', renderItems); els.filter.addEventListener('change', renderItems);
  els.exportJson.addEventListener('click', () => download(`expiryguard-v4-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 4, exportedAt: new Date().toISOString(), tenants, items, events }, null, 2), 'application/json'));
  els.exportIcs.addEventListener('click', exportCalendar);
  els.exportCsv.addEventListener('click', () => {
    const h = ['tenantId', 'tenantName', 'name', 'kind', 'source', 'expiresAt', 'recommendedStartAt', 'stage', 'impact', 'workflowState', 'owner', 'reminderDays', 'urgentDays', 'criticalDays', 'url', 'notes'];
    const rows = [h.join(','), ...items.map(i => h.map(k => csvCell(k === 'tenantName' ? tenantName(i.tenantId) : k === 'recommendedStartAt' ? recommendedStartAt(i) : k === 'stage' ? stageFor(i) : i[k])).join(','))];
    download(`expiryguard-v4-${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n'), 'text/csv;charset=utf-8');
  });
  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files[0]; if (!file) return; if (!ensureAdmin()) { els.importFile.value = ''; return; }
    try {
      const text = await file.text(); let incoming;
      if (file.name.toLowerCase().endsWith('.json')) { const p = JSON.parse(text); incoming = Array.isArray(p) ? p : (p.items || []); } else incoming = parseCsv(text);
      const manual = incoming.filter(x => x.tenantId && x.name && (x.expiresAt || x.expiry)).map(x => ({ tenantId: x.tenantId, name: x.name, kind: x.kind || x.type || 'Egendefinert', expiresAt: x.expiresAt || x.expiry, owner: x.owner || '', reminderDays: Number(x.reminderDays || x.reminder || settings.defaultReminder), urgentDays: Number(x.urgentDays || 14), criticalDays: Number(x.criticalDays || 7), impact: x.impact || 'medium', url: x.url || '', notes: x.notes || '' }));
      const result = await api('/api/manual/bulk', { method: 'POST', body: JSON.stringify({ items: manual }) }); toast(`${result.imported || 0} elementer importert`); await refresh({ quiet: true });
    } catch (err) { toast(err.message || 'Kunne ikke importere filen'); } finally { els.importFile.value = ''; }
  });

  async function loadSignedInUser() {
    const result = await api('/api/me');
    const user = result.user || {};
    els.authUser.hidden = false;
    els.authUserName.textContent = user.name || 'Microsoft-bruker';
    els.authUserAccount.textContent = user.username || user.objectId || '';
    els.authAvatar.textContent = String(user.name || user.username || '?').trim().slice(0, 1).toUpperCase();
    return user;
  }

  async function init() {
    $('year').textContent = new Date().getFullYear();
    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch {} }
    els.signIn.addEventListener('click', () => beginMicrosoftLogin().catch(err => setAuthStatus(err.message || 'Kunne ikke starte innlogging', true)));
    els.signOut.addEventListener('click', signOutLocal);
    try { await handleAuthCallback(); } catch (err) { showAuthGate(err.message || 'Microsoft-innlogging feilet', true); return; }
    await handleConsentCallback();
    if (!authSession()) {
      if (!authConfigured()) { showAuthGate('Fyll inn Microsoft auth-verdiene i config.js før du logger inn.', true); return; }
      try { await validateAuthConfiguration(); showAuthGate('Konfigurasjonen er validert. Logg inn med management-kontoen din for å fortsette.'); }
      catch (err) { showAuthGate(err.message || 'Kunne ikke validere frontend mot Worker.', true); }
      return;
    }
    try {
      await loadSignedInUser();
      showApp();
      await finalizePendingConsent();
      await refresh({ quiet: true });
    } catch (err) {
      signOutLocal();
      showAuthGate(err.message || 'Microsoft-innloggingen kunne ikke valideres av Worker.', true);
      return;
    }
    setInterval(updateLiveText, 1000);
    setInterval(() => refresh({ quiet: true }), 10 * 60 * 1000);
  }
  init();
})();
