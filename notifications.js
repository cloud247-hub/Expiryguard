(() => {
  'use strict';
  window.ExpiryGuardNotifications = {
    init({ api,L,esc,toast,getUser,getTenants,getSelectedTenant,fmtDate }) {
      const $ = id => document.getElementById(id);
      const ui = Object.fromEntries([
        'emailNotificationsButton','notificationLogButton','emailNotificationsDialog','emailNotificationsForm','emailTenantSelect',
        'emailProviderState','emailSettingsFields','emailEnabled','emailLocale','emailRecipients','addEmailRecipient',
        'emailNotifyPlanned','emailNotifyUrgent','emailNotifyCritical','emailNotifyExpired','emailLastStatus','emailFeedback',
        'emailSaveButton','emailTestButton','emailOpenLog','closeEmailNotifications','cancelEmailNotifications',
        'notificationLogDialog','notificationLogTenant','notificationLogChannel','notificationLogStatus','refreshNotificationLog',
        'notificationLogSummary','notificationLogEntries','moreNotificationLog','closeNotificationLog','doneNotificationLog'
      ].map(id => [id,$(id)]));
      let settings = null, emailEpoch = 0, emailBusy = false, logEpoch = 0, logBusy = false;
      let entries = [], nextCursor = '', retentionDays = 90;
      const canManage = () => getUser()?.isAdmin === true || getUser()?.mode === 'superadmin' || getUser()?.role === 'tenant_admin';
      const isSuper = () => getUser()?.isAdmin === true || getUser()?.mode === 'superadmin';
      const tenantId = select => canManage() ? (isSuper() ? select.value : getUser()?.tenantId || '') : '';
      const emailPath = id => `/api/email-notifications/${encodeURIComponent(id)}`;

      function fillTenants(select, requested = '') {
        const previous = select.value;
        if (!isSuper()) {
          const user = getUser();
          select.innerHTML = `<option value="${esc(user?.tenantId || '')}">${esc(user?.customerName || L('Din tenant','Your tenant'))}</option>`;
          select.disabled = true;
          return;
        }
        const tenants = getTenants().filter(t => t.enabled !== false);
        select.innerHTML = tenants.map(t => `<option value="${esc(t.id)}">${esc(t.displayName)}</option>`).join('');
        const selected = getSelectedTenant();
        const wanted = requested || (selected !== 'all' ? selected : previous);
        if (tenants.some(t => t.id === wanted)) select.value = wanted;
        select.disabled = false;
      }
      function setEmailBusy(busy) {
        emailBusy = busy;
        ui.emailSettingsFields.disabled = busy || !settings;
        ui.emailSaveButton.disabled = busy || !settings;
        ui.emailTestButton.disabled = busy || !settings?.provider?.configured;
        ui.emailTenantSelect.disabled = busy || !isSuper();
        ui.addEmailRecipient.disabled = busy || ui.emailRecipients.querySelectorAll('.email-recipient-row').length >= 20;
      }
      function feedback(message = '', error = false) {
        ui.emailFeedback.textContent = message;
        ui.emailFeedback.classList.toggle('error',error);
      }
      function recipientsFromForm() {
        return [...ui.emailRecipients.querySelectorAll('.email-recipient-row')].map(row => ({
          email:row.querySelector('[data-recipient-email]').value.trim(),
          name:row.querySelector('[data-recipient-name]').value.trim(),
          enabled:row.querySelector('[data-recipient-enabled]').checked
        }));
      }
      function renderRecipients(recipients) {
        ui.emailRecipients.innerHTML = recipients.length ? recipients.map((r,index) => `
          <div class="email-recipient-row" data-recipient-index="${index}">
            <label class="field">${L('Navn (valgfritt)','Name (optional)')}<input data-recipient-name maxlength="120" autocomplete="off" value="${esc(r.name || '')}"></label>
            <label class="field">${L('E-postadresse','Email address')}<input data-recipient-email type="email" required maxlength="254" autocomplete="off" spellcheck="false" value="${esc(r.email || '')}" placeholder="it@example.com"></label>
            <label class="email-recipient-active"><input data-recipient-enabled type="checkbox" ${r.enabled !== false ? 'checked' : ''}>${L('Aktiv','Active')}</label>
            <button type="button" class="icon-button email-remove-recipient" data-remove-recipient="${index}" aria-label="${L('Fjern mottaker','Remove recipient')}">&times;</button>
          </div>`).join('') : `<div class="queue-empty">${L('Ingen mottakere lagt til.','No recipients added.')}</div>`;
        ui.addEmailRecipient.disabled = emailBusy || recipients.length >= 20;
      }
      function renderProviderAndStatus() {
        const provider = settings?.provider;
        if (!settings) return;
        ui.emailProviderState.innerHTML = provider?.configured
          ? `<span class="teams-state-badge ok">${L('Brevo-oppsett klart','Brevo configuration ready')}</span><span class="teams-state-badge">${esc(provider.senderName)} &lt;${esc(provider.senderEmail)}&gt;</span>`
          : `<span class="teams-state-badge error">${L('Worker-oppsett mangler','Worker configuration missing')}</span><span class="notification-config-hint">${esc(provider?.issues?.join(' ') || '')}</span>`;
        ui.emailLastStatus.innerHTML = settings.lastTestAt
          ? `<strong>${settings.lastTestStatus === 'ok' ? L('Siste test akseptert av Brevo','Latest test accepted by Brevo') : L('Siste test hadde feil eller usikker status','Latest test had failures or uncertain status')}</strong><span>${esc(fmtDate(settings.lastTestAt))}</span>`
          : `<span>${L('Ingen registrert testmail enn\u00e5.','No test email recorded yet.')}</span>`;
        if (settings.lastError) ui.emailLastStatus.innerHTML += `<span class="teams-delivery-error">${esc(settings.lastError)}</span>`;
        ui.emailLastStatus.classList.toggle('error',!!settings.lastError || (!!settings.lastTestAt && settings.lastTestStatus !== 'ok'));
      }
      function renderSettings() {
        ui.emailEnabled.checked = settings.enabled;
        ui.emailLocale.value = settings.locale || 'nb';
        for (const key of ['Planned','Urgent','Critical','Expired']) ui[`emailNotify${key}`].checked = settings[`notify${key}`] !== false;
        renderRecipients(settings.recipients || []);
        renderProviderAndStatus();
      }
      async function loadEmail() {
        const id = tenantId(ui.emailTenantSelect), epoch = ++emailEpoch;
        settings = null; feedback();
        ui.emailRecipients.replaceChildren();
        ui.emailLastStatus.replaceChildren();
        ui.emailEnabled.checked = false;
        ui.emailProviderState.textContent = L('Henter e-postoppsett...','Loading email settings...');
        // Allow changing customers while fetching; epoch guards discard stale responses.
        setEmailBusy(true);
        ui.emailTenantSelect.disabled = !isSuper();
        if (!id) { ui.emailProviderState.textContent = L('Ingen kunde er valgt.','No customer selected.'); setEmailBusy(false); return; }
        try {
          const result = await api(emailPath(id));
          if (epoch !== emailEpoch || id !== tenantId(ui.emailTenantSelect)) return;
          settings = result.settings;
          renderSettings();
        } catch (error) {
          if (epoch !== emailEpoch) return;
          ui.emailProviderState.textContent = '';
          feedback(error.message || L('Kunne ikke hente e-postoppsett.','Could not load email settings.'),true);
        } finally { if (epoch === emailEpoch) setEmailBusy(false); }
      }
      async function openEmail() {
        if (!canManage()) return;
        fillTenants(ui.emailTenantSelect);
        ui.emailNotificationsDialog.showModal();
        await loadEmail();
      }
      async function saveEmail(sendTest = false) {
        if (!canManage() || emailBusy || !settings || !ui.emailNotificationsForm.reportValidity()) return;
        const id = tenantId(ui.emailTenantSelect), epoch = emailEpoch;
        if (!id || id !== settings.tenantId) return;
        const payload = { enabled:ui.emailEnabled.checked,locale:ui.emailLocale.value,recipients:recipientsFromForm() };
        for (const key of ['Planned','Urgent','Critical','Expired']) payload[`notify${key}`] = ui[`emailNotify${key}`].checked;
        setEmailBusy(true);
        feedback(sendTest ? L('Lagrer og sender testmail...','Saving and sending test email...') : L('Lagrer...','Saving...'));
        try {
          const saved = await api(emailPath(id),{method:'PATCH',body:JSON.stringify(payload)});
          if (epoch !== emailEpoch || id !== tenantId(ui.emailTenantSelect)) return;
          settings = saved.settings;
          renderSettings();
          if (sendTest) {
            const result = await api(`${emailPath(id)}/test`,{method:'POST',body:'{}'});
            if (epoch !== emailEpoch) return;
            feedback(L(`${result.accepted} akseptert, ${result.failed} feilet, ${result.unknown} med usikker status. Se varslingsloggen.`,`${result.accepted} accepted, ${result.failed} failed, ${result.unknown} uncertain. See the notification log.`),!result.ok);
            const updated = await api(emailPath(id));
            if (epoch !== emailEpoch) return;
            settings = updated.settings;
            renderProviderAndStatus();
          } else {
            feedback(L('E-postoppsettet er lagret. Teams-oppsettet er uendret.','Email settings saved. Teams settings are unchanged.'));
            toast(L('E-postvarsler lagret','Email notifications saved'));
          }
        } catch (error) { if (epoch === emailEpoch) feedback(error.message || L('Handlingen feilet.','The action failed.'),true); }
        finally { if (epoch === emailEpoch) setEmailBusy(false); }
      }
      function statusLabel(status) {
        return ({accepted:L('Akseptert','Accepted'),failed:L('Feilet','Failed'),unknown:L('Usikker status','Uncertain status'),retry_queued:L('Nytt fors\u00f8k planlagt','Retry queued')})[status] || status;
      }
      function levelLabel(level) {
        return ({planned:L('Start fornyelse','Start renewal'),urgent:L('Haster','Urgent'),critical:L('Kritisk','Critical'),expired:L('Utl\u00f8pt','Expired')})[level] || '';
      }
      function renderLog() {
        ui.notificationLogEntries.innerHTML = entries.length ? entries.map(entry => {
          const badge = entry.status === 'accepted' ? 'ok' : entry.status === 'failed' ? 'error' : 'pending';
          const type = entry.eventType === 'test' ? L('Testmail / testvarsel','Test notification') : entry.eventType === 'retry' ? L('Nytt fors\u00f8k','Retry') : levelLabel(entry.level);
          return `<article class="notification-log-entry">
            <div class="notification-entry-head"><strong>${esc(entry.itemName || type)}</strong><span class="teams-state-badge ${badge}">${esc(statusLabel(entry.status))}</span></div>
            <div class="notification-entry-meta"><span class="notification-channel-tag">${entry.channel === 'email' ? L('E-post','Email') : 'Teams'}</span><span>${esc(type)}</span><time>${esc(fmtDate(entry.createdAt))}</time></div>
            <div class="notification-recipient">${L('Mottaker','Recipient')}: <strong>${esc(entry.recipient)}</strong></div>
            ${entry.responseStatus ? `<small>HTTP ${Number(entry.responseStatus)} &middot; ${L('Fors\u00f8k','Attempt')} ${Number(entry.attempt) || 1}</small>` : ''}
            ${entry.error ? `<p class="notification-entry-error">${esc(entry.error)}</p>` : ''}
            ${entry.messageId ? `<details><summary>Brevo Message ID</summary><code>${esc(entry.messageId)}</code></details>` : ''}
            ${entry.autoRetry ? `<p class="notification-retry-note">${L('Nytt fors\u00f8k skjer ved en senere synkronisering dersom varslet fortsatt er aktuelt.','A retry will run during a later synchronization if the alert is still applicable.')}</p>` : ''}
            ${entry.canRetry ? `<button type="button" class="secondary-button notification-retry" data-retry-id="${esc(entry.deliveryId)}" data-retry-unknown="${entry.currentDeliveryStatus === 'unknown'}">${L('Planlegg nytt fors\u00f8k','Queue a retry')}</button>` : ''}
          </article>`;
        }).join('') : `<div class="queue-empty">${L('Ingen varsler matcher filteret. Loggen starter ved oppgradering til v5.4.0.','No matching notifications. History starts with the v5.4.0 upgrade.')}</div>`;
        ui.notificationLogSummary.textContent = L(`${entries.length} oppf\u00f8ringer vist. Logghistorikk beholdes i ${retentionDays} dager.`,`${entries.length} entries shown. Log history is retained for ${retentionDays} days.`);
        ui.moreNotificationLog.hidden = !nextCursor;
      }
      async function loadLog(append = false) {
        if (!canManage() || (append && logBusy)) return;
        const id = tenantId(ui.notificationLogTenant), epoch = ++logEpoch;
        if (!append) { entries = []; nextCursor = ''; ui.notificationLogEntries.replaceChildren(); }
        if (!id) { ui.notificationLogSummary.textContent = L('Ingen kunde er valgt.','No customer selected.'); return; }
        logBusy = true;
        ui.moreNotificationLog.disabled = true;
        ui.notificationLogSummary.textContent = L('Henter varslingslogg...','Loading notification log...');
        const query = new URLSearchParams({limit:'50'});
        if (ui.notificationLogChannel.value) query.set('channel',ui.notificationLogChannel.value);
        if (ui.notificationLogStatus.value) query.set('status',ui.notificationLogStatus.value);
        if (append && nextCursor) query.set('before',nextCursor);
        try {
          const result = await api(`/api/notification-log/${encodeURIComponent(id)}?${query}`);
          if (epoch !== logEpoch || id !== tenantId(ui.notificationLogTenant)) return;
          entries = append ? entries.concat(result.entries) : result.entries;
          nextCursor = result.nextCursor || ''; retentionDays = result.retentionDays || 90;
          renderLog();
        } catch (error) {
          if (epoch === logEpoch) ui.notificationLogSummary.textContent = error.message || L('Kunne ikke hente loggen.','Could not load the log.');
        } finally { if (epoch === logEpoch) {logBusy = false;ui.moreNotificationLog.disabled = false;} }
      }
      async function openLog(requestedTenant = '') {
        if (!canManage()) return;
        fillTenants(ui.notificationLogTenant,requestedTenant);
        ui.notificationLogDialog.showModal();
        await loadLog();
      }
      async function retryFromLog(button) {
        if (!canManage() || button.disabled) return;
        const id = tenantId(ui.notificationLogTenant);
        const unknown = button.dataset.retryUnknown === 'true';
        const message = unknown
          ? L('Har du kontrollert Brevo-loggen og bekreftet at meldingen ikke ble sendt? Et nytt fors\u00f8k med usikker status kan gi duplikater. Fortsett?', 'Have you checked the Brevo log and confirmed the message was not sent? Retrying an uncertain delivery can cause duplicates. Continue?')
          : L('Planlegge et nytt fors\u00f8k ved neste synkronisering?','Queue another attempt at the next synchronization?');
        if (!window.confirm(message)) return;
        button.disabled = true;
        try {
          await api(`${emailPath(id)}/retry`,{method:'POST',body:JSON.stringify({deliveryId:button.dataset.retryId,confirmUnknown:unknown})});
          toast(L('Nytt fors\u00f8k planlagt. Bruk Synkroniser for \u00e5 behandle det n\u00e5.','Retry queued. Use Synchronize to process it now.'));
          await loadLog();
        } catch (error) { toast(error.message); button.disabled = false; }
      }
      function refreshAccess() {
        const allowed = canManage();
        ui.emailNotificationsButton.hidden = !allowed;
        ui.notificationLogButton.hidden = !allowed;
        if (!allowed) {
          emailEpoch++;logEpoch++;settings = null;entries = [];nextCursor = '';
          ui.emailNotificationsDialog.close();ui.notificationLogDialog.close();
          ui.emailRecipients.replaceChildren();ui.notificationLogEntries.replaceChildren();
          feedback();setEmailBusy(false);
        }
      }
      ui.emailNotificationsButton.addEventListener('click',openEmail);
      ui.emailTenantSelect.addEventListener('change',loadEmail);
      ui.emailNotificationsForm.addEventListener('submit',event => {event.preventDefault();saveEmail(false);});
      ui.emailTestButton.addEventListener('click',() => saveEmail(true));
      ui.addEmailRecipient.addEventListener('click',() => {if (emailBusy) return;const values = recipientsFromForm();if (values.length < 20) {values.push({email:'',name:'',enabled:true});renderRecipients(values);ui.emailRecipients.querySelector('.email-recipient-row:last-child [data-recipient-email]')?.focus();}});
      ui.emailRecipients.addEventListener('click',event => {const button = event.target.closest('[data-remove-recipient]');if (!button || emailBusy) return;const values = recipientsFromForm();values.splice(Number(button.dataset.removeRecipient),1);renderRecipients(values);});
      for (const id of ['closeEmailNotifications','cancelEmailNotifications']) ui[id].addEventListener('click',() => ui.emailNotificationsDialog.close());
      ui.emailOpenLog.addEventListener('click',() => openLog(tenantId(ui.emailTenantSelect)));
      ui.notificationLogButton.addEventListener('click',() => openLog());
      for (const id of ['notificationLogTenant','notificationLogChannel','notificationLogStatus']) ui[id].addEventListener('change',() => loadLog());
      ui.refreshNotificationLog.addEventListener('click',() => loadLog());
      ui.moreNotificationLog.addEventListener('click',() => loadLog(true));
      for (const id of ['closeNotificationLog','doneNotificationLog']) ui[id].addEventListener('click',() => ui.notificationLogDialog.close());
      ui.notificationLogEntries.addEventListener('click',event => {const button = event.target.closest('[data-retry-id]');if (button) retryFromLog(button);});
      refreshAccess();
      return {
        refreshAccess,
        languageChanged() {
          if (ui.emailNotificationsDialog.open && settings) {renderRecipients(recipientsFromForm());renderProviderAndStatus();}
          if (ui.notificationLogDialog.open && !logBusy) renderLog();
        }
      };
    }
  };
})();
