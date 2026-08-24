const state = {
  lang: localStorage.getItem('asm-lang') || 'es',
  dashboard: null,
};

const labels = {
  es: {
    title: 'Panel de Control de Ana',
    subtitle: 'Control central para reglas, cadencias, prompts, canales y logs.',
    enabled: 'Activo',
    disabled: 'Apagado',
    save: 'Guardar cambio',
    confirmTitle: 'Confirmar cambio',
    confirmMessage: 'Estas a punto de modificar una configuracion del sistema Ana.',
  },
  en: {
    title: 'Ana Control Panel',
    subtitle: 'Central control for rules, cadences, prompts, channels, and logs.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    save: 'Save change',
    confirmTitle: 'Confirm change',
    confirmMessage: 'You are about to modify Ana system configuration.',
  },
};

const resourceMap = {
  rules: 'rules',
  cadences: 'cadences',
  prompts: 'prompts',
  providers: 'providers',
  channels: 'channels',
  slack: 'slack',
  emergency: 'emergency',
  workflows: 'workflows',
};

function t(key) {
  return labels[state.lang][key] || key;
}

function text(record, base) {
  return record[`${base}_${state.lang}`] || record[`${base}_es`] || record[`${base}_en`] || record[base] || '';
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return response.json();
}

async function confirmChange(message = t('confirmMessage')) {
  const dialog = qs('#confirmDialog');
  qs('#confirmTitle').textContent = t('confirmTitle');
  qs('#confirmMessage').textContent = message;
  dialog.showModal();
  const result = await new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
  });
  return result === 'confirm';
}

function renderStatus(emergency) {
  qs('#statusRow').innerHTML = emergency.map((item) => `
    <article class="status-card">
      <strong>${text(item, 'label')}</strong>
      <span class="pill ${item.enabled ? '' : 'off'}">${item.enabled ? t('enabled') : t('disabled')}</span>
    </article>
  `).join('');
}

function renderPreview(id, rows, titleFn, detailFn) {
  qs(id).innerHTML = rows.map((row) => `
    <div class="mini">
      <strong>${titleFn(row)}</strong>
      <span>${detailFn(row)}</span>
    </div>
  `).join('') || '<p class="subtitle">No records yet.</p>';
}

function renderDashboard() {
  const data = state.dashboard;
  renderStatus(data.emergency);
  qs('#rulesCount').textContent = `${data.rules.filter((row) => row.enabled).length} activas`;
  qs('#cadencesCount').textContent = `${data.cadences.filter((row) => row.enabled).length} activas`;
  qs('#providersCount').textContent = `${data.providers.filter((row) => row.enabled).length} activos`;

  renderPreview('#rulesPreview', data.rules.slice(0, 5), (row) => text(row, 'name'), (row) => `${row.severity} · ${row.actions?.join(', ') || ''}`);
  renderPreview('#cadencesPreview', data.cadences, (row) => text(row, 'name'), (row) => `${row.lead_type} · ${row.enabled ? t('enabled') : t('disabled')}`);
  renderPreview('#providersPreview', data.providers.slice(0, 5), (row) => row.name, (row) => `${row.kind} · ${row.enabled ? t('enabled') : t('disabled')}`);
  renderPreview('#slackPreview', data.slack, (row) => row.channel_label || row.name, (row) => `${row.lead_types?.join(', ') || ''}`);
  renderPreview('#workflowsPreview', data.workflows || [], (row) => row.name, (row) => `${row.module_type} · ${row.migration_status}`);
  renderTable('#errorsPreview', data.errors, ['created_at', 'severity', 'component', 'message', 'resolved']);
  renderTable('#logsList', [...data.decisions, ...data.errors], ['created_at', 'channel', 'person_id', 'status', 'reason', 'message']);
  renderTable('#testsList', data.tests || [], ['created_at', 'first_name', 'lead_type', 'channel', 'message', 'status']);
}

function renderTable(target, rows, fields) {
  if (!rows.length) {
    qs(target).innerHTML = '<p class="subtitle">Sin registros todavia.</p>';
    return;
  }

  qs(target).innerHTML = `
    <table>
      <thead><tr>${fields.map((field) => `<th>${field}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `
          <tr>${fields.map((field) => `<td>${formatValue(row[field])}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function input(name, label, value, type = 'text') {
  return `
    <label>${label}
      <input name="${name}" type="${type}" value="${value ?? ''}" />
    </label>
  `;
}

function textarea(name, label, value) {
  return `
    <label>${label}
      <textarea name="${name}">${value ?? ''}</textarea>
    </label>
  `;
}

function checkbox(name, label, checked) {
  return `
    <label class="switch">
      <input name="${name}" type="checkbox" ${checked ? 'checked' : ''} />
      ${label}
    </label>
  `;
}

function jsonField(name, label, value) {
  return textarea(name, label, JSON.stringify(value || {}, null, 2));
}

function renderEditable(resource, rows, target) {
  const html = rows.map((row) => {
    if (resource === 'rules') return ruleCard(row);
    if (resource === 'cadences') return cadenceCard(row);
    if (resource === 'prompts') return promptCard(row);
    if (resource === 'providers') return providerCard(row);
    if (resource === 'channels') return channelCard(row);
    if (resource === 'slack') return slackCard(row);
    if (resource === 'emergency') return emergencyCard(row);
    if (resource === 'workflows') return workflowCard(row);
    return '';
  }).join('');

  qs(target).innerHTML = html || '<p class="subtitle">No records yet.</p>';
}

function ruleCard(row) {
  return card('rules', row, `
    <div class="row-between">
      <div>
        <h3>${text(row, 'name')}</h3>
        <p class="subtitle">${text(row, 'notes')}</p>
      </div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="rules" data-id="${row.id}">
      <div class="form-grid">
        ${checkbox('enabled', 'Enabled', row.enabled)}
        ${input('priority', 'Priority', row.priority, 'number')}
        ${input('severity', 'Severity', row.severity)}
        ${checkbox('confirmation_required', 'Confirmation required', row.confirmation_required)}
      </div>
      ${jsonField('conditions', 'Conditions JSON', row.conditions)}
      ${input('actions', 'Actions comma-separated', row.actions?.join(', ') || '')}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function cadenceCard(row) {
  return card('cadences', row, `
    <div class="row-between">
      <div><h3>${text(row, 'name')}</h3><p class="subtitle">${row.lead_type}</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="cadences" data-id="${row.id}">
      <div class="form-grid">
        ${checkbox('enabled', 'Enabled', row.enabled)}
        ${input('min_budget', 'Min budget', row.min_budget || '', 'number')}
        ${input('max_budget', 'Max budget', row.max_budget || '', 'number')}
      </div>
      ${jsonField('stop_conditions', 'Stop conditions JSON', row.stop_conditions)}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function promptCard(row) {
  return card('prompts', row, `
    <div class="row-between">
      <div><h3>${text(row, 'name')}</h3><p class="subtitle">${row.channel || 'system'} · v${row.version}</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="prompts" data-id="${row.id}">
      ${checkbox('enabled', 'Enabled', row.enabled)}
      ${textarea('prompt_text', 'Prompt text', row.prompt_text)}
      ${jsonField('output_contract', 'Output contract JSON', row.output_contract)}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function providerCard(row) {
  return card('providers', row, `
    <div class="row-between">
      <div><h3>${row.name}</h3><p class="subtitle">${row.kind} · ${row.provider_code}</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="providers" data-id="${row.id}">
      <div class="form-grid">
        ${checkbox('enabled', 'Enabled', row.enabled)}
        ${checkbox('is_primary', 'Primary', row.is_primary)}
      </div>
      ${jsonField('config', 'Config JSON', row.config)}
      ${textarea('notes', 'Notes', row.notes || '')}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function channelCard(row) {
  return card('channels', row, `
    <div class="row-between">
      <div><h3>${row.channel.toUpperCase()}</h3><p class="subtitle">Channel control</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="channels" data-id="${row.id}">
      <div class="form-grid">
        ${checkbox('enabled', 'Enabled', row.enabled)}
        ${input('max_auto_replies_per_conversation', 'Max auto replies', row.max_auto_replies_per_conversation, 'number')}
      </div>
      ${jsonField('quiet_hours', 'Quiet hours JSON', row.quiet_hours)}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function slackCard(row) {
  return card('slack', row, `
    <div class="row-between">
      <div><h3>${row.channel_label || row.name}</h3><p class="subtitle">${row.name}</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="slack" data-id="${row.id}">
      ${checkbox('enabled', 'Enabled', row.enabled)}
      ${input('channel_label', 'Channel label', row.channel_label || '')}
      ${input('lead_types', 'Lead types comma-separated', row.lead_types?.join(', ') || '')}
      ${input('event_types', 'Event types comma-separated', row.event_types?.join(', ') || '')}
      ${textarea('notes', 'Notes', row.notes || '')}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function emergencyCard(row) {
  return card('emergency', row, `
    <div class="row-between">
      <div><h3>${text(row, 'label')}</h3><p class="subtitle">${row.scope}</p></div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="emergency" data-id="${row.id}">
      ${checkbox('enabled', 'Enabled', row.enabled)}
      ${textarea('reason', 'Reason', row.reason || '')}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function workflowCard(row) {
  return card('workflows', row, `
    <div class="row-between">
      <div>
        <h3>${row.name}</h3>
        <p class="subtitle">${row.module_type} · n8n: ${row.n8n_workflow_id || 'none'}</p>
      </div>
      <span class="pill ${row.enabled ? '' : 'off'}">${row.enabled ? t('enabled') : t('disabled')}</span>
    </div>
    <form data-resource="workflows" data-id="${row.id}">
      <div class="form-grid">
        ${checkbox('enabled', 'Enabled', row.enabled)}
        ${input('migration_status', 'Migration status', row.migration_status)}
      </div>
      ${textarea('role_description', 'Current role', row.role_description)}
      ${jsonField('control_surface', 'Control surface JSON', row.control_surface)}
      ${textarea('notes', 'Notes', row.notes || '')}
      <button class="primary">${t('save')}</button>
    </form>
  `);
}

function card(_resource, _row, body) {
  return `<article class="editor-card">${body}</article>`;
}

async function loadResource(resource, target) {
  const rows = await api(`/api/${resourceMap[resource]}`);
  renderEditable(resource, rows, target);
}

async function loadAll() {
  state.dashboard = await api('/api/dashboard');
  renderDashboard();
  await Promise.all([
    loadResource('rules', '#rulesList'),
    loadResource('cadences', '#cadencesList'),
    loadResource('prompts', '#promptsList'),
    loadResource('channels', '#channelsList'),
    loadResource('providers', '#providersList'),
    loadResource('slack', '#slackList'),
    loadResource('emergency', '#emergencyList'),
    loadResource('workflows', '#workflowsList'),
  ]);
}

async function loadTests() {
  const tests = await api('/api/test-leads');
  renderTable('#testsList', tests, ['created_at', 'first_name', 'lead_type', 'channel', 'message', 'status']);
}

function payloadFromForm(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) payload[key] = value;

  form.querySelectorAll('input[type="checkbox"]').forEach((inputElement) => {
    payload[inputElement.name] = inputElement.checked;
  });

  ['actions', 'lead_types', 'event_types'].forEach((field) => {
    if (payload[field]) {
      payload[field] = payload[field].split(',').map((item) => item.trim()).filter(Boolean);
    }
  });

  ['priority', 'min_budget', 'max_budget', 'max_auto_replies_per_conversation'].forEach((field) => {
    if (payload[field] === '') payload[field] = null;
    else if (payload[field] !== undefined) payload[field] = Number(payload[field]);
  });

  return payload;
}

function wireEvents() {
  qsa('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      qsa('.nav-item').forEach((item) => item.classList.remove('active'));
      qsa('.view').forEach((view) => view.classList.remove('active-view'));
      button.classList.add('active');
      qs(`#${button.dataset.view}`).classList.add('active-view');
    });
  });

  qs('#refreshButton').addEventListener('click', loadAll);
  qs('#seedButton').addEventListener('click', async () => {
    const ok = await confirmChange('Esto cargara las reglas, prompts, cadencias y proveedores default si faltan.');
    if (!ok) return;
    await api('/api/seed-defaults', { method: 'POST', body: JSON.stringify({}) });
    await loadAll();
  });

  qs('#sandboxForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = payloadFromForm(event.target);
    const result = await api('/api/test-leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    qs('#sandboxDecision').textContent = JSON.stringify(result.simulated_decision, null, 2);
    await loadTests();
  });
  qs('#languageToggle').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    localStorage.setItem('asm-lang', state.lang);
    applyLanguage();
    renderDashboard();
    loadAll();
  });

  document.body.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-resource]');
    if (!form) return;
    event.preventDefault();

    const ok = await confirmChange();
    if (!ok) return;

    const payload = payloadFromForm(form);
    await api(`/api/${form.dataset.resource}/${form.dataset.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await loadAll();
  });
}

function applyLanguage() {
  qs('#languageToggle').textContent = state.lang === 'es' ? 'EN' : 'ES';
  qsa('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

wireEvents();
applyLanguage();
loadAll().catch((error) => {
  document.body.insertAdjacentHTML('beforeend', `<pre style="margin-left:300px;color:#b00020">${error.message}</pre>`);
});
