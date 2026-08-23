(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const cfg = window.EXPIRYGUARD_CONFIG || {};
  const i18n = window.ExpiryGuardI18n || { getLanguage: () => 'nb', locale: () => 'nb-NO', text: value => String(value ?? ''), translateDom: () => {}, onChange: () => {} };
  const L = (nb, en) => i18n.getLanguage() === 'en' ? en : nb;
  const tr = value => i18n.text(String(value ?? ''));
  const API_BASE = String(cfg.apiBase || '').replace(/\/$/, '');
  const SETTINGS_KEY = 'cloud247-expiryguard-v5-settings';
  const NOTIFY_KEY = 'cloud247-expiryguard-v5-notify-state';
  const AUTH_KEY = 'cloud247-expiryguard-v5.1.5-session';
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
    authGate: $('authGate'), appMain: $('appMain'), appFooter: $('appFooter'), signIn: $('signInButton'), signOut: $('signOutButton'), authStatus: $('authStatus'), authUser: $('authUser'), authAvatar: $('authAvatar'), authUserName: $('authUserName'), authUserAccount: $('authUserAccount'), authUserRole: $('authUserRole'), importButton: $('importButton'), workflowPanel: $('workflowPanel'), accessBanner: $('accessBanner'),
    portalUsers: $('portalUsersButton'), portalUsersDialog: $('portalUsersDialog'), portalUsersList: $('portalUsersList'), portalUsersSummary: $('portalUsersSummary'), portalUsersTenantFilter: $('portalUsersTenantFilter'), refreshPortalUsers: $('refreshPortalUsersButton'),
    auditLog: $('auditLogButton'), auditDialog: $('auditDialog'), auditList: $('auditList'), auditSummary: $('auditSummary'), refreshAudit: $('refreshAuditButton')
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
  let currentUser = null;
  let auditEntries = [];
  let portalUsers = [];

  function loadSettings() {
    const defaults = { defaultReminder: 30, notifyEnabled: false, notificationCadence: 12, rotateTenants: false, rotateSeconds: 30 };
    try { return { ...defaults, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
    catch { return defaults; }
  }
  function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  function authSession() { try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
  function setAuthSession(v) { if (v) sessionStorage.setItem(AUTH_KEY, JSON.stringify(v)); else sessionStorage.removeItem(AUTH_KEY); }
  function isManagement() { return currentUser?.mode === 'superadmin' || currentUser?.isAdmin === true; }
  function isCustomer() { return currentUser?.mode === 'tenant'; }
  function isTenantAdmin() { return currentUser?.role === 'tenant_admin'; }
  function isPending() { return currentUser?.role === 'pending'; }
  function canManagePortalUsers() { return isManagement() || isTenantAdmin(); }
  function canWrite() { return isManagement() || ['tenant_admin', 'tenant_editor'].includes(currentUser?.role); }
  function toast(msg) { els.toast.textContent = tr(msg); els.toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => els.toast.classList.remove('show'), 2800); }
  function esc(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

  async function validateAuthConfiguration() {
    if (!API_BASE || API_BASE.includes('YOUR-SUBDOMAIN')) throw new Error('Worker-URL er ikke konfigurert i config.js.');
    const response = await fetch(`${API_BASE}/api/config`, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Worker config-feil (${response.status})`);
    if (data.authMode !== 'microsoft-entra-assignment-app-rbac') throw new Error('Worker kjører ikke ExpiryGuard assignment + app RBAC.');
    if (!data.portalAuthClientId) throw new Error('Worker mangler GRAPH_CLIENT_ID / ExpiryGuard app client ID.');
    return data;
  }

  async function beginMicrosoftLogin() {
    try { await validateAuthConfiguration(); } catch (err) { setAuthStatus(err.message || 'Auth-konfigurasjonen er ugyldig.', true); return; }
    const returnUrl = `${location.origin}${location.pathname}`;
    location.assign(`${API_BASE}/api/auth/start?return=${encodeURIComponent(returnUrl)}`);
  }

  async function handleAuthCallback() {
    const p = new URLSearchParams(location.search);
    const authError = p.get('auth_error');
    if (authError) { cleanAuthQuery(); throw new Error(authError); }
    const code = p.get('login_code');
    if (!code) return false;
    const response = await fetch(`${API_BASE}/api/auth/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ code })
    });
    const data = await response.json().catch(() => ({}));
    cleanAuthQuery();
    if (!response.ok || !data.accessToken) throw new Error(data.error || 'Kunne ikke opprette ExpiryGuard-session.');
    setAuthSession({ accessToken: data.accessToken, expiresAt: data.expiresAt || '' });
    return true;
  }

  function cleanAuthQuery() { history.replaceState({}, '', `${location.pathname}${location.hash}`); }
  async function accessToken() {
    const current = authSession();
    if (!current?.accessToken) return '';
    if (current.expiresAt && new Date(current.expiresAt).getTime() <= Date.now() + 5000) { setAuthSession(null); return ''; }
    return current.accessToken;
  }
  function setAuthStatus(message, error = false) { els.authStatus.textContent = tr(message); els.authStatus.classList.toggle('auth-error', error); }
  function showAuthGate(message = 'Logg inn med Microsoft for å åpne ExpiryGuard.', error = false) { els.authGate.hidden = false; els.appMain.hidden = true; els.appFooter.hidden = true; els.authUser.hidden = true; setAuthStatus(message, error); }
  function showApp() { els.authGate.hidden = true; els.appMain.hidden = false; els.appFooter.hidden = false; }
  function signOutLocal() {
    const current = authSession();
    if (current?.accessToken && API_BASE) {
      fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${current.accessToken}` }, keepalive: true }).catch(() => {});
    }
    setAuthSession(null); currentUser = null; tenants = []; items = []; events = [];
    document.body.classList.remove('customer-mode', 'viewer-mode');
    showAuthGate('Du er logget ut av ExpiryGuard.');
  }

  async function api(path, options = {}) {
    if (!API_BASE || API_BASE.includes('YOUR-SUBDOMAIN')) throw new Error('API er ikke konfigurert i config.js');
    const token = await accessToken();
    if (!token) { signOutLocal(); const err = new Error('Microsoft-innlogging kreves'); err.status = 401; throw err; }
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const text = await response.text(); let data = {}; try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (response.status === 401) signOutLocal();
    if (!response.ok) { const err = new Error(data.error || data.message || `HTTP ${response.status}`); err.status = response.status; err.code = data.code || ''; err.data = data; throw err; }
    return data;
  }

  function applyAccessMode() {
    const customer = isCustomer();
    const write = canWrite();
    document.body.classList.toggle('customer-mode', customer);
    document.body.classList.toggle('viewer-mode', customer && !write);
    if (els.addTenant) els.addTenant.hidden = !isManagement();
    if (els.manageTenants) els.manageTenants.hidden = !isManagement();
    if (els.syncAll) els.syncAll.hidden = !isManagement();
    if (els.importButton) els.importButton.hidden = !isManagement();
    if (els.exportJson) els.exportJson.hidden = !isManagement();
    if (els.exportCsv) els.exportCsv.hidden = !isManagement();
    if (els.exportIcs) els.exportIcs.hidden = !isManagement();
    if (els.portalUsers) els.portalUsers.hidden = !canManagePortalUsers();
    if (els.auditLog) els.auditLog.hidden = !isManagement();
    if (els.addManual) els.addManual.hidden = !write;
    if (els.workflowPanel) els.workflowPanel.hidden = !write;
    if (els.accessBanner) {
      els.accessBanner.hidden = !customer;
      if (customer) {
        const role = currentUser?.roleLabel || L('Venter på rolle', 'Waiting for role');
        const writeText = isPending() ? L('Entra-tilgang er godkjent, men en Tenant Admin må tildele rollen din i ExpiryGuard før kundedata vises.', 'Entra access is approved, but a Tenant Admin must assign your role in ExpiryGuard before customer data is shown.') : write ? L('Du kan oppdatere arbeidsstatus, notater og manuelle elementer.', 'You can update work status, notes and manual items.') : L('Du har lesetilgang.', 'You have read-only access.');
        els.accessBanner.innerHTML = `<strong>${esc(role)} · ${esc(currentUser.customerName || L('Din tenant', 'Your tenant'))}</strong><span>${L('Microsoft Entra bestemmer hvem som får logge inn. ExpiryGuard bestemmer rollen inne i appen.', 'Microsoft Entra controls who can sign in. ExpiryGuard controls the role inside the app.')} ${writeText}</span>`;
      }
    }
  }

  function parseDate(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  function secondsUntil(v) { const d = parseDate(v); return d ? Math.floor((d.getTime() - Date.now()) / 1000) : Number.NEGATIVE_INFINITY; }
  function secondsLeft(v) { return secondsUntil(v); }
  function daysLeft(v) { return secondsLeft(v) / 86400; }
  function fmtDate(v, withTime = true) {
    const d = parseDate(v); if (!d) return '–';
    return new Intl.DateTimeFormat(i18n.locale(), withTime ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
  function formatDuration(seconds, compact = false) {
    let s = Math.max(0, Math.floor(Math.abs(seconds)));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); const sec = s % 60;
    if (i18n.getLanguage() === 'en') {
      if (compact) {
        if (d > 0) return `${d} d ${h} h`;
        if (h > 0) return `${h} h ${m} min`;
        return `${m} min ${sec} sec`;
      }
      return d > 0 ? `${d} d ${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min` : `${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} sec`;
    }
    if (compact) {
      if (d > 0) return `${d} d ${h} t`;
      if (h > 0) return `${h} t ${m} min`;
      return `${m} min ${sec} sek`;
    }
    return d > 0 ? `${d} d ${String(h).padStart(2, '0')} t ${String(m).padStart(2, '0')} min` : `${String(h).padStart(2, '0')} t ${String(m).padStart(2, '0')} min ${String(sec).padStart(2, '0')} sek`;
  }
  function formatRemaining(v) {
    const s = secondsLeft(v); if (!Number.isFinite(s)) return L('Ukjent', 'Unknown');
    return s < 0 ? L(`Utløpt for ${formatDuration(s)} siden`, `Expired ${formatDuration(s)} ago`) : formatDuration(s);
  }
  function addDays(v, days) { const d = parseDate(v); return d ? new Date(d.getTime() + Number(days) * DAY).toISOString() : ''; }
  function recommendedStartAt(item) { return addDays(item.expiresAt, -policyFor(item).startDays); }

  function sourceLabel(source) {
    return ({ 'graph-apns': 'Graph · Apple Push', 'graph-ade': 'Graph · ADE', 'graph-vpp': 'Graph · VPP', 'manual': L('Manuell', 'Manual') })[source] || source || L('Ukjent', 'Unknown');
  }
  function tenantById(id) { return tenants.find(t => t.id === id); }
  function tenantName(id) { return tenantById(id)?.displayName || id || L('Ukjent', 'Unknown'); }
  function impactLabel(v) { return i18n.getLanguage() === 'en' ? ({ low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' })[v] || 'Medium' : ({ low: 'Lav', medium: 'Medium', high: 'Høy', critical: 'Kritisk' })[v] || 'Medium'; }
  function workflowLabel(v) { return i18n.getLanguage() === 'en' ? ({ not_started: 'Not started', in_progress: 'In progress', waiting: 'Waiting', completed: 'Renewed' })[v] || 'Not started' : ({ not_started: 'Ikke startet', in_progress: 'Pågår', waiting: 'Venter', completed: 'Fornyet' })[v] || 'Ikke startet'; }
  function workflowClass(v) { return ({ not_started: 'not-started', in_progress: 'in-progress', waiting: 'waiting', completed: 'completed' })[v] || 'not-started'; }
  function stageLabel(v) { return i18n.getLanguage() === 'en' ? ({ planned: 'Planned', action: 'Start now', urgent: 'Urgent', critical: 'Critical', expired: 'Expired' })[v] || v : ({ planned: 'Planlagt', action: 'Start nå', urgent: 'Haster', critical: 'Kritisk', expired: 'Utløpt' })[v] || v; }
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
    if (stage === 'expired') return L('Utløpt – håndter umiddelbart', 'Expired – handle immediately');
    if (stage === 'critical') return L('Kritisk – prioriter i dag', 'Critical – prioritize today');
    if (stage === 'urgent') return L('Haster – bør allerede være i gang', 'Urgent – should already be in progress');
    if (stage === 'action') return L('Anbefalt startvindu er åpnet', 'Recommended start window is open');
    const s = secondsUntil(recommendedStartAt(item));
    return s > 0 ? L(`Start om ${formatDuration(s, true)}`, `Start in ${formatDuration(s, true)}`) : L('Start nå', 'Start now');
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
    if (t.lastSyncStatus === 'error') return { level: 'error', text: L('Synk-feil', 'Sync error') };
    if (t.lastSyncStatus === 'partial') return { level: 'warning', text: L('Delvis synk', 'Partial sync') };
    const d = parseDate(t.lastSyncAt);
    if (!d) return { level: 'warning', text: L('Ikke synkronisert', 'Not synchronized') };
    if (Date.now() - d.getTime() > 12 * HOUR) return { level: 'warning', text: L('Synk er eldre enn 12 t', 'Sync is older than 12 h') };
    return { level: 'ok', text: L('Synkronisert', 'Synchronized') };
  }

  function renderTenants() {
    els.allTenantCount.textContent = `${tenants.length} ${tenants.length === 1 ? 'tenant' : 'tenants'}`;
    els.tenantList.innerHTML = tenants.map(t => {
      const count = items.filter(i => i.tenantId === t.id).length;
      const attention = tenantAttentionCount(t.id);
      const health = tenantSyncHealth(t);
      return `<button class="tenant-choice ${selectedTenant === t.id ? 'active' : ''}" data-tenant="${esc(t.id)}" type="button"><span class="tenant-icon">${esc((t.displayName || '?').slice(0, 1).toUpperCase())}</span><span><strong>${esc(t.displayName)}</strong><small>${count} ${L('elementer', 'items')}${attention ? ` · ${attention} ${L('tiltak', 'actions')}` : ''} · ${esc(health.text)}</small></span>${attention ? `<b class="tenant-alert">${attention}</b>` : ''}</button>`;
    }).join('');
    document.querySelector('[data-tenant="all"]')?.classList.toggle('active', selectedTenant === 'all');
    els.manualTenant.innerHTML = tenants.map(t => `<option value="${esc(t.id)}">${esc(t.displayName)}</option>`).join('');
    if (isManagement()) renderManageTenants();
  }

  function renderManageTenants() {
    if (!isManagement()) { els.manageTenantList.innerHTML = ''; return; }
    els.manageTenantList.innerHTML = tenants.length ? tenants.map(t => {
      const attention = tenantAttentionCount(t.id);
      const health = tenantSyncHealth(t);
      return `<div class="manage-row" data-id="${esc(t.id)}"><div><strong>${esc(t.displayName)}</strong><small>${esc(t.id)}</small><small>${attention} ${L('tiltak', 'actions')} · ${esc(health.text)} · ${L('Sist synk', 'Last sync')}: ${t.lastSyncAt ? fmtDate(t.lastSyncAt) : L('aldri', 'never')}${t.lastSyncError ? ` · ${esc(t.lastSyncError)}` : ''}</small></div><div class="manage-actions"><button class="secondary-button sync-tenant" type="button">${L('↻ Synk', '↻ Sync')}</button><button class="danger-button remove-tenant" type="button">${L('Fjern', 'Remove')}</button></div></div>`;
    }).join('') : `<div class="empty-state"><p>${L('Ingen kunder lagt til.', 'No customers added.')}</p></div>`;
  }

  function renderHealth() {
    const scopeTenants = tenants.filter(t => selectedTenant === 'all' || t.id === selectedTenant);
    const issues = scopeTenants.map(t => ({ t, h: tenantSyncHealth(t) })).filter(x => x.h.level !== 'ok');
    if (!issues.length) { els.healthBanner.hidden = true; return; }
    els.healthBanner.hidden = false;
    els.healthBanner.innerHTML = `<strong>⚠ ${L('Datakvalitet:', 'Data quality:')}</strong> ${issues.slice(0, 4).map(x => `${esc(x.t.displayName)} – ${esc(x.h.text)}`).join(' · ')}${issues.length > 4 ? ` · +${issues.length - 4} ${L('flere', 'more')}` : ''}`;
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
      els.actionQueue.innerHTML = `<div class="queue-empty">${L('Ingen elementer ennå.', 'No items yet.')}</div>`;
      return;
    }
    els.actionQueue.innerHTML = list.map(i => {
      const p = policyFor(i), stage = stageFor(i);
      const start = recommendedStartAt(i);
      return `<button class="queue-item ${stage}" data-detail-id="${esc(i.id)}" type="button"><span class="queue-status"><b>${esc(stageLabel(stage))}</b><small>${esc(impactLabel(p.impact))} ${L('konsekvens', 'impact')}</small></span><span class="queue-main"><strong>${esc(i.name)}</strong><small>${esc(tenantName(i.tenantId))} · ${L('Start', 'Start')} ${fmtDate(start, false)} · ${L('Utløper', 'Expires')} ${fmtDate(i.expiresAt, false)}</small></span><span class="queue-time">${esc(actionText(i))}</span><span class="queue-arrow">→</span></button>`;
    }).join('');
  }

  function renderItems() {
    const visible = visibleItems();
    els.empty.hidden = visible.length > 0;
    els.tableWrap.hidden = visible.length === 0 || document.body.classList.contains('display-mode');
    els.dashboardGrid.hidden = visible.length === 0;

    els.itemsBody.innerHTML = visible.map(i => {
      const stage = stageFor(i), p = policyFor(i), isManual = i.source === 'manual';
      return `<tr data-id="${esc(i.id)}"><td><span class="item-title">${esc(tenantName(i.tenantId))}</span></td><td><button class="link-button open-detail" type="button"><span class="item-title">${esc(i.name)}</span><span class="item-sub">${esc(sourceLabel(i.source))}${i.owner ? ` · ${esc(i.owner)}` : ''}</span></button></td><td><span class="item-title">${fmtDate(recommendedStartAt(i), false)}</span><span class="item-sub">${p.startDays} ${L('dager før', 'days before')}</span></td><td>${fmtDate(i.expiresAt)}</td><td><span class="live-expiry countdown" data-item-id="${esc(i.id)}">${formatRemaining(i.expiresAt)}</span></td><td><span class="badge ${stage}">${stageLabel(stage)}</span><span class="item-sub">${esc(actionText(i))}</span></td><td><span class="workflow-badge ${workflowClass(i.workflowState)}">${esc(workflowLabel(i.workflowState))}</span></td><td><div class="row-actions"><button class="icon-button open-detail" type="button" title="${L('Detaljer', 'Details')}">→</button>${i.url ? `<a class="icon-button" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" title="${L('Åpne', 'Open')}">↗</a>` : ''}${isManual && canWrite() ? `<button class="icon-button edit-manual" type="button" title="${L('Rediger', 'Edit')}">✎</button><button class="icon-button delete-manual" type="button" title="${L('Slett', 'Delete')}">×</button>` : ''}</div></td></tr>`;
    }).join('');

    els.dashboardGrid.innerHTML = visible.slice(0, 32).map(i => {
      const stage = stageFor(i), p = policyFor(i);
      return `<button class="expiry-tile ${stage}" data-detail-id="${esc(i.id)}" type="button"><div class="expiry-tile-head"><small>${esc(tenantName(i.tenantId))}</small><span class="badge ${stage}">${stageLabel(stage)}</span></div><h3>${esc(i.name)}</h3><small>${esc(sourceLabel(i.source))}</small><div class="tile-plan"><span>${L('Start:', 'Start:')} <b>${fmtDate(recommendedStartAt(i), false)}</b></span><span>${L('Utløp:', 'Expiration:')} <b>${fmtDate(i.expiresAt, false)}</b></span></div><div class="live-expiry countdown" data-item-id="${esc(i.id)}">${formatRemaining(i.expiresAt)}</div><div class="tile-footer"><span>${esc(impactLabel(p.impact))} ${L('konsekvens', 'impact')}</span><span class="workflow-badge ${workflowClass(i.workflowState)}">${esc(workflowLabel(i.workflowState))}</span></div></button>`;
    }).join('');

    els.overviewTitle.textContent = selectedTenant === 'all' ? L('Alle kunder', 'All customers') : tenantName(selectedTenant);
    const syncDates = tenants.filter(t => selectedTenant === 'all' || t.id === selectedTenant).map(t => parseDate(t.lastSyncAt)).filter(Boolean).sort((a, b) => b - a);
    els.syncLine.textContent = syncDates[0] ? L(`Sist synkronisert ${fmtDate(syncDates[0].toISOString())}`, `Last synchronized ${fmtDate(syncDates[0].toISOString())}`) : L('Ikke synkronisert ennå', 'Not synchronized yet');
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
      els.heroTitle.textContent = authSession() ? L('Ingen elementer', 'No items') : L('Logg inn med Microsoft', 'Sign in with Microsoft');
      els.heroTenant.textContent = authSession() ? (isCustomer() ? L('Ingen utløpsdatoer registrert for din tenant', 'No expiration dates are registered for your tenant') : L('Legg til en kunde eller manuelt element', 'Add a customer or manual item')) : L('Microsoft-innlogging kreves', 'Microsoft sign-in required');
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
    els.heroRecommendation.textContent = `${stageLabel(stage)} · ${L('Start', 'Start')} ${fmtDate(recommendedStartAt(next), false)} · ${L('Utløper', 'Expires')} ${fmtDate(next.expiresAt, false)} · ${impactLabel(p.impact)} ${L('konsekvens', 'impact')}`;
    els.heroDot.className = `status-dot ${stage}`;
  }

  function heroTiming(item) {
    const stage = stageFor(item);
    if (stage === 'planned') return L(`Start om ${formatDuration(secondsUntil(recommendedStartAt(item)), true)}`, `Start in ${formatDuration(secondsUntil(recommendedStartAt(item)), true)}`);
    return formatRemaining(item.expiresAt);
  }

  function renderActivity() {
    const list = events.filter(e => selectedTenant === 'all' || e.tenantId === selectedTenant).slice(0, 8);
    if (!list.length) { els.activityList.innerHTML = `<div class="queue-empty">${L('Ingen historikk ennå. Fornyelser registreres automatisk når en utløpsdato flyttes frem.', 'No history yet. Renewals are detected automatically when an expiration date moves forward.')}</div>`; return; }
    els.activityList.innerHTML = list.map(e => `<div class="activity-row"><span class="activity-icon">${e.eventType === 'renewal_detected' ? '✓' : e.eventType === 'workflow_changed' ? '↻' : '•'}</span><span><strong>${esc(e.message || e.eventType)}</strong><small>${esc(tenantName(e.tenantId))} · ${fmtDate(e.createdAt)}${e.newExpiresAt ? ` · ${L('ny dato', 'new date')} ${fmtDate(e.newExpiresAt, false)}` : ''}</small></span></div>`).join('');
  }

  function portalRoleLabel(role) {
    return ({ pending: L('Venter på rolle', 'Waiting for role'), viewer: 'Tenant Viewer', editor: 'Tenant Editor', admin: 'Tenant Admin' })[role] || L('Venter på rolle', 'Waiting for role');
  }

  function renderPortalUsersTenantFilter() {
    if (!els.portalUsersTenantFilter) return;
    if (!isManagement()) {
      els.portalUsersTenantFilter.innerHTML = `<option value="${esc(currentUser?.tenantId || '')}">${esc(currentUser?.customerName || L('Din tenant', 'Your tenant'))}</option>`;
      els.portalUsersTenantFilter.disabled = true;
      return;
    }
    els.portalUsersTenantFilter.disabled = false;
    const current = els.portalUsersTenantFilter.value;
    els.portalUsersTenantFilter.innerHTML = `<option value="">${L('Alle kunder', 'All customers')}</option>${tenants.map(t => `<option value="${esc(t.id)}">${esc(t.displayName)}</option>`).join('')}`;
    if ([...els.portalUsersTenantFilter.options].some(o => o.value === current)) els.portalUsersTenantFilter.value = current;
  }

  function renderPortalUsers() {
    if (!els.portalUsersList) return;
    renderPortalUsersTenantFilter();
    const tenantFilter = isManagement() ? (els.portalUsersTenantFilter?.value || '') : (currentUser?.tenantId || '');
    const visible = portalUsers.filter(u => !tenantFilter || u.tenantId === tenantFilter);
    const counts = visible.reduce((a, u) => { a.total++; if (u.blocked) a.blocked++; else if (u.appRole === 'pending') a.pending++; else a.active++; return a; }, { total: 0, active: 0, pending: 0, blocked: 0 });
    if (els.portalUsersSummary) els.portalUsersSummary.textContent = L(`${counts.active} aktive · ${counts.pending} venter · ${counts.blocked} blokkert`, `${counts.active} active · ${counts.pending} pending · ${counts.blocked} blocked`);
    if (!visible.length) { els.portalUsersList.innerHTML = `<div class="queue-empty">${L('Ingen kjente brukere ennå. En bruker vises her etter at Entra har gitt tilgang og brukeren har forsøkt å logge inn én gang.', 'No known users yet. A user appears here after Entra grants access and the user attempts to sign in once.')}</div>`; return; }
    els.portalUsersList.innerHTML = visible.map(u => {
      const name = u.displayName || u.username || u.objectId;
      const tenant = u.tenantName || tenantName(u.tenantId);
      const appRole = portalRoleLabel(u.appRole);
      const effective = u.blocked ? L('Blokkert av Cloud247', 'Blocked by Cloud247') : appRole;
      const selfManaged = !isManagement() && u.objectId === currentUser?.objectId;
      const roleActions = selfManaged ? `<span class="portal-user-pill">${L('Din egen rolle endres av en annen Tenant Admin eller Cloud247', 'Your own role is changed by another Tenant Admin or Cloud247')}</span>` : `<button class="secondary-button portal-user-action" data-action="viewer" type="button">Viewer</button><button class="secondary-button portal-user-action" data-action="editor" type="button">Editor</button><button class="secondary-button portal-user-action" data-action="admin" type="button">Tenant Admin</button><button class="secondary-button portal-user-action" data-action="pending" type="button">${L('Fjern rolle', 'Remove role')}</button>`;
      const cloudActions = isManagement() ? `${u.blocked ? `<button class="secondary-button portal-user-action" data-action="unblock" type="button">${L('Opphev blokkering', 'Unblock')}</button>` : `<button class="danger-button portal-user-action" data-action="block" type="button">${L('Blokker', 'Block')}</button>`}<button class="secondary-button portal-user-action" data-action="remove" type="button">${L('Fjern fra oversikt', 'Remove from list')}</button>` : '';
      return `<div class="portal-user-row" data-tenant="${esc(u.tenantId)}" data-oid="${esc(u.objectId)}"><div class="portal-user-main"><strong>${esc(name)}</strong><small>${esc(u.username || '')}</small><small>${esc(tenant)} · Object ID ${esc(u.objectId)}</small><div class="portal-user-meta"><span class="portal-user-pill">${L('App-rolle', 'App role')}: ${esc(appRole)}</span><span class="portal-user-pill">${L('Entra-tilgang', 'Entra access')}: ${L('bekreftet ved innlogging', 'confirmed by sign-in')}</span><span class="portal-user-pill ${u.blocked ? 'denied' : (u.appRole === 'pending' ? 'pending' : 'active')}">${L('Effektiv', 'Effective')}: ${esc(effective)}</span>${u.lastSeenAt ? `<span class="portal-user-pill">${L('Sist sett', 'Last seen')}: ${fmtDate(u.lastSeenAt)}</span>` : ''}</div></div><div class="portal-user-actions">${roleActions}${cloudActions}</div></div>`;
    }).join('');
  }

  async function loadPortalUsers() {
    if (!canManagePortalUsers()) return;
    if (els.portalUsersList) els.portalUsersList.innerHTML = `<div class="queue-empty">${L('Henter brukere og roller…', 'Loading users and roles…')}</div>`;
    try { const result = await api('/api/portal-users'); portalUsers = result.users || []; renderPortalUsers(); }
    catch (err) { portalUsers = []; if (els.portalUsersList) els.portalUsersList.innerHTML = `<div class="queue-empty">${esc(err.message || L('Kunne ikke hente portalbrukere', 'Could not load portal users'))}</div>`; }
  }

  async function changePortalUser(row, action) {
    if (!canManagePortalUsers()) return;
    const tenantId = row?.dataset?.tenant || ''; const oid = row?.dataset?.oid || '';
    if (!tenantId || !oid) return;
    try {
      if (action === 'remove') {
        if (!ensureAdmin()) return;
        await api(`/api/portal-users/${encodeURIComponent(tenantId)}/${encodeURIComponent(oid)}`, { method: 'DELETE' });
      } else {
        const payload = { appRole: ['pending', 'viewer', 'editor', 'admin'].includes(action) ? action : (portalUsers.find(u => u.tenantId === tenantId && u.objectId === oid)?.appRole || 'pending') };
        if (action === 'block') payload.blocked = true;
        if (action === 'unblock') payload.blocked = false;
        await api(`/api/portal-users/${encodeURIComponent(tenantId)}/${encodeURIComponent(oid)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      toast(L('Tilgang oppdatert', 'Access updated')); await loadPortalUsers();
    } catch (err) { toast(err.message || L('Kunne ikke oppdatere tilgang', 'Could not update access')); }
  }

  function auditActionLabel(action) {
    const labels = {
      'tenant.consent_started': L('Consent startet', 'Consent started'),
      'tenant.connected': L('Kunde koblet til', 'Customer connected'),
      'tenant.deleted': L('Kunde fjernet', 'Customer removed'),
      'sync.requested': L('Synkronisering startet', 'Synchronization started'),
      'sync.scheduled': L('Planlagt synkronisering', 'Scheduled synchronization'),
      'manual.created': L('Manuelt element opprettet', 'Manual item created'),
      'manual.updated': L('Manuelt element oppdatert', 'Manual item updated'),
      'manual.deleted': L('Manuelt element slettet', 'Manual item deleted'),
      'manual.bulk_imported': L('Bulkimport gjennomført', 'Bulk import completed'),
      'workflow.updated': L('Arbeidsstatus oppdatert', 'Work status updated'),
      'portal_user.override_updated': L('Rolleoverstyring oppdatert', 'Role override updated'),
      'portal_user.blocked': L('Portalbruker blokkert', 'Portal user blocked'),
      'portal_user.removed': L('Portalbruker fjernet', 'Portal user removed'),
      'request.failed': L('Avvist eller feilet endringsforsøk', 'Rejected or failed change request')
    };
    return labels[action] || action || L('Ukjent handling', 'Unknown action');
  }

  function renderAuditLog() {
    if (!els.auditList) return;
    if (!auditEntries.length) {
      els.auditList.innerHTML = `<div class="queue-empty">${L('Ingen loggoppføringer ennå.', 'No audit entries yet.')}</div>`;
      if (els.auditSummary) els.auditSummary.textContent = L('0 oppføringer', '0 entries');
      return;
    }
    if (els.auditSummary) els.auditSummary.textContent = L(`${auditEntries.length} siste oppføringer`, `${auditEntries.length} latest entries`);
    els.auditList.innerHTML = auditEntries.map(entry => {
      const actor = entry.actorLabel || entry.actorOid || entry.actorMode || '–';
      const tenant = entry.targetTenantId ? tenantName(entry.targetTenantId) : '';
      const target = entry.targetId && entry.targetId !== 'all' ? entry.targetId : '';
      return `<div class="audit-row"><span class="audit-status ${esc(entry.outcome || 'success')}">${entry.outcome === 'success' ? '✓' : '!'}</span><span class="audit-main"><strong>${esc(auditActionLabel(entry.action))}</strong><small>${fmtDate(entry.createdAt)} · ${esc(actor)}${tenant ? ` · ${esc(tenant)}` : ''}</small>${target ? `<small>${L('Mål', 'Target')}: ${esc(target)}</small>` : ''}</span><code>${esc(entry.requestId || '')}</code></div>`;
    }).join('');
  }

  async function loadAuditLog() {
    if (!ensureAdmin()) return;
    if (els.auditList) els.auditList.innerHTML = `<div class="queue-empty">${L('Henter sikkerhetslogg…', 'Loading security log…')}</div>`;
    try {
      const result = await api('/api/audit?limit=150');
      auditEntries = result.entries || [];
      renderAuditLog();
    } catch (err) {
      auditEntries = [];
      if (els.auditList) els.auditList.innerHTML = `<div class="queue-empty">${esc(err.message || L('Kunne ikke hente sikkerhetsloggen', 'Could not load the security log'))}</div>`;
    }
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
    const now = new Intl.DateTimeFormat(i18n.locale(), { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    if (!document.body.classList.contains('display-mode')) { els.displayMeta.textContent = ''; return; }
    let extra = '';
    if (settings.rotateTenants && nextRotationAt > Date.now()) extra = L(` · neste kunde om ${Math.ceil((nextRotationAt - Date.now()) / 1000)} sek`, ` · next customer in ${Math.ceil((nextRotationAt - Date.now()) / 1000)} sec`);
    els.displayMeta.textContent = `${now}${extra}`;
  }

  async function refresh({ quiet = false } = {}) {
    if (refreshing) return;
    if (!authSession()) { render(); if (!quiet) toast('Logg inn med Microsoft først'); return; }
    refreshing = true; if (!quiet) els.syncLine.textContent = L('Henter data…', 'Loading data…');
    try {
      const [t, i] = await Promise.all([api('/api/tenants'), api('/api/items')]);
      tenants = t.tenants || []; items = i.items || [];
      try { const e = await api('/api/events?limit=100'); events = e.events || []; } catch { events = []; }
      if (isCustomer()) selectedTenant = tenants[0]?.id || currentUser?.tenantId || 'all';
      else if (selectedTenant !== 'all' && !tenants.some(x => x.id === selectedTenant)) selectedTenant = 'all';
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
    toast(tenantId ? L('Synkroniserer kunde…', 'Synchronizing customer…') : L('Synkroniserer alle kunder…', 'Synchronizing all customers…'));
    try {
      const result = await api('/api/sync', { method: 'POST', body: JSON.stringify(tenantId ? { tenantId } : {}) });
      toast(L(`Synk ferdig: ${result.ok || 0} OK, ${result.failed || 0} feil`, `Sync complete: ${result.ok || 0} OK, ${result.failed || 0} failed`));
      await refresh({ quiet: true });
    } catch (err) { toast(err.message || 'Synkronisering feilet'); }
  }

  function ensureAdmin() { if (isManagement()) return true; toast('Denne handlingen krever Cloud247 Super Admin'); return false; }
  function ensureWrite() { if (canWrite()) return true; toast('Tenant Viewer har kun lesetilgang'); return false; }
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
    els.manualPolicyHint.innerHTML = L(`<strong>Plan:</strong><p>Start ${start} dager før · Haster fra ${urgent} dager · Kritisk fra ${critical} dager før utløp. Dette kan tilpasses per element.</p>`, `<strong>Plan:</strong><p>Start ${start} days before · Urgent from ${urgent} days · Critical from ${critical} days before expiration. This can be customized per item.</p>`);
  }
  function openManual(item = null) {
    if (!ensureWrite()) return;
    if (!tenants.length) { toast('Legg til minst én kunde først'); return; }
    els.manualForm.reset();
    els.manualId.value = item?.id || '';
    els.manualTenant.value = isCustomer() ? (currentUser?.tenantId || tenants[0]?.id || '') : (item?.tenantId || (selectedTenant !== 'all' ? selectedTenant : tenants[0].id));
    els.manualTenant.disabled = isCustomer();
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
    $('manualEyebrow').textContent = item ? L('REDIGER MANUELT ELEMENT', 'EDIT MANUAL ITEM') : L('MANUELT ELEMENT', 'MANUAL ITEM');
    $('manualTitle').textContent = item ? L('Rediger utløpsdato', 'Edit expiration date') : L('Legg til utløpsdato', 'Add expiration date');
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
    els.detailSummary.innerHTML = `<div><span>${L('Planstatus', 'Plan status')}</span><strong><span class="badge ${stage}">${stageLabel(stage)}</span></strong></div><div><span>${L('Anbefalt start', 'Recommended start')}</span><strong>${fmtDate(recommendedStartAt(item))}</strong><small>${p.startDays} ${L('dager før utløp', 'days before expiration')}</small></div><div><span>${L('Utløper', 'Expires')}</span><strong>${fmtDate(item.expiresAt)}</strong><small class="detail-live countdown">${formatRemaining(item.expiresAt)}</small></div><div><span>${L('Konsekvens', 'Impact')}</span><strong>${impactLabel(p.impact)}</strong><small>${actionText(item)}</small></div>`;
    els.detailRecommendationTitle.textContent = tr(p.title);
    els.detailRecommendation.innerHTML = `${esc(tr(p.recommendation))}<br><br><small>${esc(tr(p.rationale))}</small>`;
    els.detailRunbook.innerHTML = `<ol>${p.steps.map(step => `<li>${esc(tr(step))}</li>`).join('')}</ol>`;
    els.workflowNote.value = item.workflowNote || '';
    if (els.workflowPanel) els.workflowPanel.hidden = !canWrite();
    renderWorkflowButtons();
    const meta = { [L('Eier / Apple-konto', 'Owner / Apple account')]: item.owner || '', [L('Kildestatus', 'Source status')]: item.state || '', [L('Sist oppdatert', 'Last updated')]: fmtDate(item.updatedAt), [L('Sist fornyet oppdaget', 'Last renewal detected')]: item.lastRenewedAt ? fmtDate(item.lastRenewedAt) : '', ...friendlyMetadata(item.metadata) };
    els.detailMetadata.innerHTML = Object.entries(meta).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => `<div><span>${esc(k)}</span><strong>${esc(String(v))}</strong></div>`).join('');
    if (p.docsUrl) { els.detailDocs.hidden = false; els.detailDocs.href = p.docsUrl; } else { els.detailDocs.hidden = true; els.detailDocs.removeAttribute('href'); }
    if (item.url) { els.detailAdmin.hidden = false; els.detailAdmin.href = item.url; } else { els.detailAdmin.hidden = true; els.detailAdmin.removeAttribute('href'); }
    if (!els.detailDialog.open) els.detailDialog.showModal();
  }

  function friendlyMetadata(metadata = {}) {
    const out = {};
    const map = {
      appleIdentifier: 'Apple ID', topicIdentifier: 'Topic ID', certificateSerialNumber: L('Sertifikatserienummer', 'Certificate serial number'), organizationName: L('Organisasjon', 'Organization'), vppTokenAccountType: L('VPP-kontotype', 'VPP account type'), lastSyncDateTime: L('Siste VPP-synk', 'Last VPP sync'), lastSyncStatus: L('VPP-synkstatus', 'VPP sync status'), countryOrRegion: L('Land/region', 'Country/region'), tokenName: 'ADE-token', tokenType: L('Token-type', 'Token type'), lastSuccessfulSyncDateTime: L('Siste vellykkede ADE-synk', 'Last successful ADE sync'), lastSyncErrorCode: L('ADE-synkfeil', 'ADE sync error'), syncedDeviceCount: L('Synkroniserte enheter', 'Synchronized devices')
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
    els.workflowButtons.querySelectorAll('[data-workflow]').forEach(b => { b.classList.toggle('active', b.dataset.workflow === detailSelectedWorkflow); b.disabled = !canWrite(); });
    els.workflowNote.disabled = !canWrite();
    els.saveWorkflow.hidden = !canWrite();
  }

  async function saveWorkflow() {
    if (!ensureWrite()) return;
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
      `${L('Kunde', 'Customer')}: ${tenantName(item.tenantId)}`,
      `${L('Planstatus', 'Plan status')}: ${stageLabel(stage)}`,
      `${L('Konsekvens', 'Impact')}: ${impactLabel(p.impact)}`,
      `${L('Anbefalt start', 'Recommended start')}: ${fmtDate(recommendedStartAt(item))}`,
      `${L('Utløper', 'Expires')}: ${fmtDate(item.expiresAt)}`,
      `${L('Tid igjen', 'Time remaining')}: ${formatRemaining(item.expiresAt)}`,
      `${L('Eier/konto', 'Owner/account')}: ${item.owner || L('Ikke registrert', 'Not registered')}`,
      '',
      tr(p.title),
      tr(p.recommendation),
      '',
      L('Foreslått sjekkliste:', 'Suggested checklist:'),
      ...p.steps.map((step, n) => `${n + 1}. ${tr(step)}`)
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
    els.notifications.textContent = granted ? L('🔔 Varsler på', '🔔 Notifications on') : L('🔕 Varsler av', '🔕 Notifications off');
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
    if (counts.expired) parts.push(L(`${counts.expired} utløpt`, `${counts.expired} expired`));
    if (counts.critical) parts.push(L(`${counts.critical} kritisk`, `${counts.critical} critical`));
    if (counts.urgent) parts.push(L(`${counts.urgent} haster`, `${counts.urgent} urgent`));
    if (counts.action) parts.push(L(`${counts.action} bør startes`, `${counts.action} should be started`));
    const title = L(`ExpiryGuard: ${attention.length} krever oppmerksomhet`, `ExpiryGuard: ${attention.length} require attention`);
    const options = { body: parts.join(' · '), icon: 'assets/cloud247-mark.svg', badge: 'assets/cloud247-mark.svg', tag: 'expiryguard-summary', renotify: true, data: { url: location.pathname || './' } };
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
    const isConsentReturn = !!expectedState && p.get('state') === expectedState;
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
    if (!authSession() || !isManagement()) { showAuthGate('Kunden har godkjent Graph-consent. Logg inn med Cloud247 management-konto for å fullføre.'); return; }
    try {
      const pending = JSON.parse(raw); toast('Bekrefter Graph-tilgang…');
      await api('/api/tenants/confirm', { method: 'POST', body: JSON.stringify(pending) });
      sessionStorage.removeItem('expiryguard-pending-consent'); toast('Kunden er koblet til. Sett Assignment required = Yes og tildel brukere i kundens Enterprise Application. Roller tildeles i ExpiryGuard.');
      await refresh({ quiet: true }); await sync(pending.tenantId);
    } catch (err) { toast(err.message || 'Kunne ikke fullføre tenant-tilkoblingen'); }
  }


  function icsEscape(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function icsDate(v) { const d = parseDate(v); return d ? d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : ''; }
  function exportCalendar() {
    const now = icsDate(new Date().toISOString());
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cloud247//ExpiryGuard v5.1.5//NO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Cloud247 ExpiryGuard'];
    for (const item of items) {
      const p = policyFor(item);
      const tenant = tenantName(item.tenantId);
      const startAt = recommendedStartAt(item);
      const desc = `${L('Kunde', 'Customer')}: ${tenant}\n${L('Konsekvens', 'Impact')}: ${impactLabel(p.impact)}\n${L('Utløper', 'Expires')}: ${fmtDate(item.expiresAt)}\n${tr(p.recommendation)}`;
      lines.push('BEGIN:VEVENT', `UID:${icsEscape(item.id)}-start@expiryguard.cloud247.no`, `DTSTAMP:${now}`, `DTSTART:${icsDate(startAt)}`, `SUMMARY:${icsEscape(L(`ExpiryGuard: Start fornyelse – ${item.name}`, `ExpiryGuard: Start renewal – ${item.name}`))}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
      lines.push('BEGIN:VEVENT', `UID:${icsEscape(item.id)}-expiry@expiryguard.cloud247.no`, `DTSTAMP:${now}`, `DTSTART:${icsDate(item.expiresAt)}`, `SUMMARY:${icsEscape(L(`ExpiryGuard: UTLØPER – ${item.name}`, `ExpiryGuard: EXPIRES – ${item.name}`))}`, `DESCRIPTION:${icsEscape(desc)}`, 'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    download(`expiryguard-v5.1.5-${new Date().toISOString().slice(0, 10)}.ics`, lines.join('\r\n'), 'text/calendar;charset=utf-8');
  }

  function download(name, text, type) { const blob = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function csvCell(v) {
    let s = String(v ?? '').replace(/\u0000/g, '');
    // Prevent spreadsheet formula injection when exported CSV is opened in Excel/Sheets.
    if (/^[\u0001-\u0020]*[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
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
  els.manageTenantList.addEventListener('click', async e => { const row = e.target.closest('.manage-row'); if (!row) return; const id = row.dataset.id; if (e.target.closest('.sync-tenant')) await sync(id); if (e.target.closest('.remove-tenant')) { const t = tenantById(id); pendingAction = { type: 'removeTenant', id }; els.confirmTitle.textContent = L('Fjerne kunde?', 'Remove customer?'); els.confirmText.textContent = L(`${t?.displayName || id} og lagrede ExpiryGuard-data for kunden fjernes. Admin consent i kundens tenant påvirkes ikke.`, `${t?.displayName || id} and stored ExpiryGuard data for the customer will be removed. Admin consent in the customer tenant is not affected.`); els.confirm.showModal(); } });
  els.syncAll.addEventListener('click', () => sync());
  els.notifications.addEventListener('click', requestNotifications);
  els.fullscreen.addEventListener('click', async () => { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); } catch { toast('Fullskjerm støttes ikke i denne nettleseren'); } });
  els.displayMode.addEventListener('click', () => { document.body.classList.toggle('display-mode'); els.displayMode.textContent = document.body.classList.contains('display-mode') ? L('← Avslutt dashboard-modus', '← Exit dashboard mode') : L('◫ Dashboard-modus', '◫ Dashboard mode'); renderItems(); startRotation(); });
  els.settings.addEventListener('click', openSettings); els.cancelSettings.addEventListener('click', () => els.settingsDialog.close());
  els.portalUsers?.addEventListener('click', async () => { if (!canManagePortalUsers()) return; els.portalUsersDialog.showModal(); await loadPortalUsers(); });
  els.refreshPortalUsers?.addEventListener('click', loadPortalUsers);
  els.portalUsersTenantFilter?.addEventListener('change', renderPortalUsers);
  els.portalUsersList?.addEventListener('click', async e => { const button = e.target.closest('.portal-user-action'); if (!button) return; const row = button.closest('.portal-user-row'); await changePortalUser(row, button.dataset.action); });
  els.auditLog?.addEventListener('click', async () => { if (!ensureAdmin()) return; els.auditDialog.showModal(); await loadAuditLog(); });
  els.refreshAudit?.addEventListener('click', loadAuditLog);
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
    const manualUrl = els.manualUrl.value.trim();
    if (manualUrl) {
      try { const parsed = new URL(manualUrl); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); }
      catch { toast(L('Administrasjonslenken må starte med https://', 'The administration link must use https://')); return; }
    }
    const payload = { tenantId: els.manualTenant.value, kind: els.manualKind.value, name: els.manualName.value.trim(), expiresAt: new Date(els.manualExpiry.value).toISOString(), reminderDays: start, urgentDays: urgent, criticalDays: critical, impact: els.manualImpact.value, owner: els.manualOwner.value.trim(), url: manualUrl, notes: els.manualNotes.value.trim() };
    try { await api(id ? `/api/manual/${encodeURIComponent(id)}` : '/api/manual', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); els.manualDialog.close(); toast(id ? 'Element oppdatert' : 'Element lagt til'); await refresh({ quiet: true }); } catch (err) { toast(err.message || 'Kunne ikke lagre'); }
  });

  els.itemsBody.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return; const item = items.find(i => i.id === tr.dataset.id); if (!item) return;
    if (e.target.closest('.open-detail')) openDetail(item);
    if (e.target.closest('.edit-manual') && canWrite()) openManual(item);
    if (e.target.closest('.delete-manual') && canWrite()) { pendingAction = { type: 'deleteManual', id: item.id }; els.confirmTitle.textContent = L('Slette element?', 'Delete item?'); els.confirmText.textContent = L(`${item.name} fjernes fra ExpiryGuard.`, `${item.name} will be removed from ExpiryGuard.`); els.confirm.showModal(); }
  });
  els.dashboardGrid.addEventListener('click', e => { const b = e.target.closest('[data-detail-id]'); if (b) openDetail(b.dataset.detailId); });
  els.actionQueue.addEventListener('click', e => { const b = e.target.closest('[data-detail-id]'); if (b) openDetail(b.dataset.detailId); });
  els.workflowButtons.addEventListener('click', e => { if (!canWrite()) return; const b = e.target.closest('[data-workflow]'); if (!b) return; detailSelectedWorkflow = b.dataset.workflow; renderWorkflowButtons(); });
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
  els.exportJson.addEventListener('click', () => download(`expiryguard-v5.1.5-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: '5.1.5', exportedAt: new Date().toISOString(), tenants, items, events }, null, 2), 'application/json'));
  els.exportIcs.addEventListener('click', exportCalendar);
  els.exportCsv.addEventListener('click', () => {
    const h = ['tenantId', 'tenantName', 'name', 'kind', 'source', 'expiresAt', 'recommendedStartAt', 'stage', 'impact', 'workflowState', 'owner', 'reminderDays', 'urgentDays', 'criticalDays', 'url', 'notes'];
    const rows = [h.join(','), ...items.map(i => h.map(k => csvCell(k === 'tenantName' ? tenantName(i.tenantId) : k === 'recommendedStartAt' ? recommendedStartAt(i) : k === 'stage' ? stageFor(i) : i[k])).join(','))];
    download(`expiryguard-v5.1.5-${new Date().toISOString().slice(0, 10)}.csv`, rows.join('\n'), 'text/csv;charset=utf-8');
  });
  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files[0]; if (!file) return; if (!ensureAdmin()) { els.importFile.value = ''; return; }
    if (file.size > 1024 * 1024) { toast(L('Importfilen kan være maks 1 MB', 'Import file can be at most 1 MB')); els.importFile.value = ''; return; }
    try {
      const text = await file.text(); let incoming;
      if (file.name.toLowerCase().endsWith('.json')) { const p = JSON.parse(text); incoming = Array.isArray(p) ? p : (p.items || []); } else incoming = parseCsv(text);
      const manual = incoming.filter(x => x.tenantId && x.name && (x.expiresAt || x.expiry)).map(x => ({ tenantId: x.tenantId, name: x.name, kind: x.kind || x.type || 'Egendefinert', expiresAt: x.expiresAt || x.expiry, owner: x.owner || '', reminderDays: Number(x.reminderDays || x.reminder || settings.defaultReminder), urgentDays: Number(x.urgentDays || 14), criticalDays: Number(x.criticalDays || 7), impact: x.impact || 'medium', url: x.url || '', notes: x.notes || '' }));
      const result = await api('/api/manual/bulk', { method: 'POST', body: JSON.stringify({ items: manual }) }); toast(L(`${result.imported || 0} elementer importert`, `${result.imported || 0} items imported`)); await refresh({ quiet: true });
    } catch (err) { toast(err.message || 'Kunne ikke importere filen'); } finally { els.importFile.value = ''; }
  });

  async function loadSignedInUser() {
    const result = await api('/api/me');
    const user = result.user || {};
    currentUser = user;
    els.authUser.hidden = false;
    els.authUserName.textContent = user.name || 'Microsoft-bruker';
    els.authUserAccount.textContent = user.customerName ? `${user.customerName} · ${user.username || user.objectId || ''}` : (user.username || user.objectId || '');
    els.authUserRole.textContent = user.roleLabel || (user.isAdmin ? 'Cloud247 Super Admin' : 'Tenant Viewer');
    els.authAvatar.textContent = String(user.name || user.username || '?').trim().slice(0, 1).toUpperCase();
    applyAccessMode();
    return user;
  }

  i18n.onChange(() => {
    if (currentUser || authSession()) render();
    else i18n.translateDom(document);
    if (els.detailDialog.open && detailItemId) {
      const item = items.find(i => i.id === detailItemId);
      if (item) openDetail(item);
    }
    if (els.manualDialog.open) updateManualPolicyHint();
    if (els.portalUsersDialog?.open) renderPortalUsers();
    if (els.auditDialog?.open) renderAuditLog();
    updateNotificationButton();
  });

  async function init() {
    $('year').textContent = new Date().getFullYear();
    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch {} }
    if (els.signIn) els.signIn.addEventListener('click', () => beginMicrosoftLogin().catch(err => setAuthStatus(err.message || 'Kunne ikke starte Microsoft-innlogging', true)));
    els.signOut.addEventListener('click', signOutLocal);
    try { await handleAuthCallback(); } catch (err) { showAuthGate(err.message || 'Microsoft-innlogging feilet', true); return; }
    await handleConsentCallback();
    if (!authSession()) {
      try {
        await validateAuthConfiguration();
        showAuthGate('Logg inn med Microsoft. Kundebrukere bruker sin egen Entra-tenant og får kun tilgang til sin egen kunde.');
      } catch (err) { showAuthGate(err.message || 'Kunne ikke validere frontend mot Worker.', true); }
      return;
    }
    try {
      await loadSignedInUser();
      showApp();
      if (isManagement()) await finalizePendingConsent();
      if (!isPending()) await refresh({ quiet: true });
      else { tenants = []; items = []; events = []; render(); }
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
