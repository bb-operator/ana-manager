const state = {
  data: null,
  resources: {},
};

const ruleLabels = {
  agent_request_handoff: {
    title: 'Lead pide agente o llamada',
    plain: 'Si alguien dice call me, agente, showing, ASAP o cita, Ana debe parar y mandar handoff.',
  },
  frustration_human_review: {
    title: 'Lead molesto o agresivo',
    plain: 'Si el lead se frustra, insulta o amenaza con irse con otro agente, Ana se calla.',
  },
  no_listing_promise: {
    title: 'No prometer listings',
    plain: 'Ana no puede decir que enviará opciones/listings si no existe una integración real.',
  },
  short_term_airbnb: {
    title: 'Airbnb / corto plazo',
    plain: 'Si busca Airbnb, furnished o menos de 12 meses, Ana debe ser honesta y detener cadencia normal.',
  },
  stop_after_handoff: {
    title: 'Parar después de handoff',
    plain: 'Cuando el lead ya fue handed off o qualified, Ana no debe seguir respondiendo.',
  },
  respect_no_call: {
    title: 'Respetar “no llamada”',
    plain: 'Si el lead dice que no quiere llamada, Ana no debe volver a pedir llamada.',
  },
};

const actionOptions = [
  ['handoff', 'Enviar a humano'],
  ['mark_qualified', 'Marcar qualified'],
  ['notify_slack', 'Mandar Slack'],
  ['stop_cadence', 'Parar cadencia'],
  ['block_reply', 'Bloquear respuesta'],
  ['human_review', 'Revisión humana'],
  ['mark_unqualified', 'Marcar no calificado'],
  ['allow_reply', 'Permitir respuesta'],
];

const dom = (selector) => document.querySelector(selector);
const domAll = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function confirmChange(message) {
  dom('#confirmMessage').textContent = message || 'Vas a cambiar una configuración de Ana.';
  const dialog = dom('#confirmDialog');
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

function money(value) {
  if (!value) return 'Sin límite';
  return Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function statusPill(enabled) {
  return `<span class="status ${enabled ? 'on' : 'off'}">${enabled ? 'ON' : 'OFF'}</span>`;
}

function actionLabel(action) {
  return actionOptions.find(([value]) => value === action)?.[1] || action;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value !== 'string') return [value];
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).split(',').map((item) => item.replace(/^"|"$/g, '').trim()).filter(Boolean);
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
}

function conditionText(rule) {
  const conditions = rule.conditions || {};
  const phrases = conditions.phrases || conditions.signals || [];
  if (!phrases.length) return '';
  return phrases.join(', ');
}

function checked(values, value) {
  return values?.includes(value) ? 'checked' : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderDecision(target, decision) {
  const actionTitles = {
    handoff: 'Handoff inmediato',
    human_review: 'Revisión humana',
    mark_unqualified: 'No calificado',
    budget_review: 'Revisión por presupuesto',
    continue_qualification: 'Continuar calificación',
    respect_channel_preference: 'Respetar canal preferido',
  };

  dom(target).innerHTML = `
    <div class="decision-top">
      <span class="decision-action">${actionTitles[decision.action] || decision.action}</span>
      ${statusPill(!decision.stop_ai)}
    </div>
    <div class="decision-grid">
      <div><small>Ana responde</small><strong>${decision.should_reply ? 'Sí' : 'No'}</strong></div>
      <div><small>Qualified</small><strong>${decision.qualified ? 'Sí' : 'No'}</strong></div>
      <div><small>Slack</small><strong>${decision.should_notify_slack ? 'Sí' : 'No'}</strong></div>
      <div><small>Stop AI</small><strong>${decision.stop_ai ? 'Sí' : 'No'}</strong></div>
    </div>
    <p>${escapeHtml(decision.reason || 'Sin razón registrada.')}</p>
    <details>
      <summary>Ver JSON técnico</summary>
      <pre>${escapeHtml(JSON.stringify(decision, null, 2))}</pre>
    </details>
  `;
}

function renderSystemStrip() {
  const controls = state.data.emergency || [];
  dom('#systemStrip').innerHTML = controls.map((item) => `
    <button class="system-tile ${item.enabled ? '' : 'disabled'}" data-view-jump="system">
      <span>${escapeHtml(item.label_es || item.key)}</span>
      ${statusPill(item.enabled)}
    </button>
  `).join('');
}

function renderMetrics() {
  const data = state.data;
  const activeRules = data.rules.filter((item) => item.enabled).length;
  const activeCadences = data.cadences.filter((item) => item.enabled).length;
  const activeProviders = data.providers.filter((item) => item.enabled).length;
  const recentTests = data.tests?.length || 0;
  dom('#metricGrid').innerHTML = `
    <article class="metric"><span>${activeRules}</span><p>Reglas activas</p></article>
    <article class="metric"><span>${activeCadences}</span><p>Cadencias activas</p></article>
    <article class="metric"><span>${activeProviders}</span><p>Proveedores activos</p></article>
    <article class="metric"><span>${recentTests}</span><p>Tests recientes</p></article>
  `;
}

function renderDashboard() {
  renderSystemStrip();
  renderMetrics();
  dom('#criticalRules').innerHTML = state.data.rules.slice(0, 6).map((rule) => `
    <div class="summary-row">
      <div>
        <strong>${escapeHtml(ruleLabels[rule.key]?.title || rule.name_es)}</strong>
        <span>${escapeHtml(toArray(rule.actions).map(actionLabel).join(' · '))}</span>
      </div>
      ${statusPill(rule.enabled)}
    </div>
  `).join('');

  dom('#workflowMap').innerHTML = (state.data.workflows || []).map((workflow) => `
    <article class="workflow-card">
      <span>${escapeHtml(workflow.module_type)}</span>
      <h3>${escapeHtml(workflow.name)}</h3>
      <p>${escapeHtml(workflow.role_description)}</p>
      <small>${escapeHtml(workflow.migration_status)} · ${escapeHtml(workflow.n8n_workflow_id)}</small>
    </article>
  `).join('');
}

function renderSystem() {
  dom('#systemControls').innerHTML = (state.data.emergency || []).map((control) => `
    <article class="control-card ${control.enabled ? '' : 'danger-zone'}">
      <div>
        <h3>${escapeHtml(control.label_es || control.key)}</h3>
        <p>${control.scope === 'system' ? 'Control global' : `Canal ${control.scope.toUpperCase()}`}</p>
      </div>
      <label class="toggle">
        <input type="checkbox" data-resource="emergency" data-id="${control.id}" data-field="enabled" ${control.enabled ? 'checked' : ''} />
        <span></span>
      </label>
    </article>
  `).join('');
}

function renderRules() {
  dom('#ruleCards').innerHTML = state.data.rules.map((rule) => `
    <article class="operator-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(ruleLabels[rule.key]?.title || rule.name_es)}</h3>
          <p>${escapeHtml(ruleLabels[rule.key]?.plain || rule.notes_es || '')}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" data-resource="rules" data-id="${rule.id}" data-field="enabled" ${rule.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="rules" data-id="${rule.id}">
        <label>Frases / señales que activan esta regla
          <textarea name="phrases">${escapeHtml(conditionText(rule))}</textarea>
        </label>
        <div class="action-grid">
          ${actionOptions.map(([value, label]) => `
            <label class="check-chip">
              <input type="checkbox" name="actions" value="${value}" ${checked(toArray(rule.actions), value)} />
              <span>${label}</span>
            </label>
          `).join('')}
        </div>
        <div class="form-footer">
          <span>Prioridad ${rule.priority} · ${rule.severity}</span>
          <button class="button primary">Guardar regla</button>
        </div>
      </form>
    </article>
  `).join('');
}

function renderCadences() {
  const stepsByCadence = (state.data.cadenceSteps || []).reduce((groups, step) => {
    groups[step.cadence_id] ||= [];
    groups[step.cadence_id].push(step);
    return groups;
  }, {});
  dom('#cadenceCards').innerHTML = state.data.cadences.map((cadence) => {
    const steps = stepsByCadence[cadence.id] || [];
    return `
      <article class="operator-card">
        <div class="operator-head">
          <div>
            <h3>${cadence.lead_type.toUpperCase()}</h3>
            <p>${escapeHtml(cadence.name_es || cadence.name_en)}</p>
          </div>
          <label class="toggle">
            <input type="checkbox" data-resource="cadences" data-id="${cadence.id}" data-field="enabled" ${cadence.enabled ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
        <form class="operator-form" data-resource="cadences" data-id="${cadence.id}">
          <div class="form-row">
            <label>Budget mínimo<input name="min_budget" type="number" value="${cadence.min_budget || ''}" placeholder="sin mínimo" /></label>
            <label>Budget máximo<input name="max_budget" type="number" value="${cadence.max_budget || ''}" placeholder="sin máximo" /></label>
          </div>
          <div class="budget-note">Rango actual: ${money(cadence.min_budget)} a ${money(cadence.max_budget)}</div>
          <div class="step-list">
            ${steps.map((step) => `
              <div class="step-row">
                <strong>Step ${step.step_number}</strong>
                <span>${step.channel.toUpperCase()}</span>
                <span>${step.delay_minutes === 0 ? 'Inmediato' : `${step.delay_minutes} min`}</span>
                ${statusPill(step.enabled)}
              </div>
            `).join('') || '<p class="empty">Sin pasos todavía.</p>'}
          </div>
          <div class="form-footer">
            <span>Stop: replied, qualified, handed off, review</span>
            <button class="button primary">Guardar cadencia</button>
          </div>
        </form>
      </article>
    `;
  }).join('');
}

function renderPrompts() {
  dom('#promptCards').innerHTML = state.data.prompts.map((prompt) => `
    <article class="operator-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(prompt.name_es || prompt.name_en)}</h3>
          <p>${prompt.channel || 'system'} · version ${prompt.version}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" data-resource="prompts" data-id="${prompt.id}" data-field="enabled" ${prompt.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="prompts" data-id="${prompt.id}">
        <label>Prompt
          <textarea name="prompt_text" class="prompt-box">${escapeHtml(prompt.prompt_text || '')}</textarea>
        </label>
        <div class="form-footer">
          <span>Este texto será la fuente central para n8n cuando lo conectemos.</span>
          <button class="button primary">Guardar prompt</button>
        </div>
      </form>
    </article>
  `).join('');
}

function renderProviders() {
  dom('#channelCards').innerHTML = state.data.channels.map((channel) => `
    <article class="operator-card compact">
      <div class="operator-head">
        <div><h3>${channel.channel.toUpperCase()}</h3><p>Máx respuestas auto: ${channel.max_auto_replies_per_conversation}</p></div>
        <label class="toggle">
          <input type="checkbox" data-resource="channels" data-id="${channel.id}" data-field="enabled" ${channel.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="channels" data-id="${channel.id}">
        <label>Máx respuestas automáticas<input name="max_auto_replies_per_conversation" type="number" value="${channel.max_auto_replies_per_conversation}" /></label>
        <button class="button primary">Guardar canal</button>
      </form>
    </article>
  `).join('');

  dom('#providerCards').innerHTML = state.data.providers.map((provider) => `
    <article class="operator-card compact">
      <div class="operator-head">
        <div><h3>${escapeHtml(provider.name)}</h3><p>${provider.kind} · ${provider.provider_code}</p></div>
        <label class="toggle">
          <input type="checkbox" data-resource="providers" data-id="${provider.id}" data-field="enabled" ${provider.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="providers" data-id="${provider.id}">
        <label>Notas<textarea name="notes">${escapeHtml(provider.notes || '')}</textarea></label>
        <button class="button primary">Guardar proveedor</button>
      </form>
    </article>
  `).join('');
}

function renderSlack() {
  dom('#slackCards').innerHTML = state.data.slack.map((route) => `
    <article class="operator-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(route.channel_label || route.name)}</h3>
          <p>${escapeHtml(route.name)}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" data-resource="slack" data-id="${route.id}" data-field="enabled" ${route.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="slack" data-id="${route.id}">
        <div class="form-row">
          <label>Nombre visible<input name="channel_label" value="${escapeHtml(route.channel_label || '')}" /></label>
          <label>Lead types<input name="lead_types" value="${escapeHtml(toArray(route.lead_types).join(', '))}" /></label>
        </div>
        <label>Eventos<input name="event_types" value="${escapeHtml(toArray(route.event_types).join(', '))}" /></label>
        <label>Notas<textarea name="notes">${escapeHtml(route.notes || '')}</textarea></label>
        <button class="button primary">Guardar Slack route</button>
      </form>
    </article>
  `).join('');
}

function renderTables() {
  renderTable('#testsList', state.data.tests || [], ['created_at', 'first_name', 'lead_type', 'channel', 'message', 'status']);
  renderTable('#logsList', [...(state.data.decisions || []), ...(state.data.errors || [])], ['created_at', 'channel', 'person_id', 'status', 'reason', 'message']);
}

function renderTable(target, rows, fields) {
  if (!rows.length) {
    dom(target).innerHTML = '<div class="empty">Sin registros todavía.</div>';
    return;
  }
  dom(target).innerHTML = `
    <table>
      <thead><tr>${fields.map((field) => `<th>${field}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${fields.map((field) => `<td>${escapeHtml(format(row[field]))}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function format(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function payloadFromForm(form) {
  const data = new FormData(form);
  const payload = {};
  for (const [key, value] of data.entries()) payload[key] = value;

  if (form.dataset.resource === 'rules') {
    const actions = data.getAll('actions');
    const phrases = String(payload.phrases || '').split(',').map((item) => item.trim()).filter(Boolean);
    delete payload.phrases;
    payload.actions = actions;
    payload.conditions = { phrases };
  }

  ['lead_types', 'event_types'].forEach((field) => {
    if (payload[field]) payload[field] = payload[field].split(',').map((item) => item.trim()).filter(Boolean);
  });

  ['min_budget', 'max_budget', 'max_auto_replies_per_conversation'].forEach((field) => {
    if (payload[field] === '') payload[field] = null;
    else if (payload[field] !== undefined) payload[field] = Number(payload[field]);
  });

  return payload;
}

async function patch(resource, id, payload) {
  await api(`/api/${resource}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

function setStatus(ok, text) {
  dom('#syncDot').className = ok ? 'ok' : 'bad';
  dom('#syncText').textContent = text;
}

async function loadAll() {
  state.data = await api('/api/dashboard');
  state.data.prompts = await api('/api/prompts');
  state.data.channels = await api('/api/channels');
  renderDashboard();
  renderSystem();
  renderRules();
  renderCadences();
  renderPrompts();
  renderProviders();
  renderSlack();
  renderTables();
  setStatus(true, 'Sistema cargado');
}

function activate(view) {
  domAll('.nav').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  domAll('.view').forEach((section) => section.classList.toggle('active', section.id === view));
}

function wireEvents() {
  domAll('.nav').forEach((button) => button.addEventListener('click', () => activate(button.dataset.view)));
  document.body.addEventListener('click', (event) => {
    const jump = event.target.closest('[data-jump], [data-view-jump]');
    if (jump) activate(jump.dataset.jump || jump.dataset.viewJump);
  });

  dom('#refreshButton').addEventListener('click', loadAll);
  dom('#seedButton').addEventListener('click', async () => {
    if (!(await confirmChange('Esto cargará la configuración base de Ana si falta algo.'))) return;
    await api('/api/seed-defaults', { method: 'POST', body: '{}' });
    await loadAll();
  });

  document.body.addEventListener('change', async (event) => {
    const input = event.target.closest('input[data-resource][data-field]');
    if (!input) return;
    const label = input.checked ? 'activar' : 'apagar';
    if (!(await confirmChange(`Confirmar ${label} este control.`))) {
      input.checked = !input.checked;
      return;
    }
    await patch(input.dataset.resource, input.dataset.id, { [input.dataset.field]: input.checked });
    await loadAll();
  });

  document.body.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-resource]');
    if (!form) return;
    event.preventDefault();
    if (!(await confirmChange('Guardar este cambio en Ana Manager.'))) return;
    await patch(form.dataset.resource, form.dataset.id, payloadFromForm(form));
    await loadAll();
  });

  dom('#sandboxForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await api('/api/test-leads', {
      method: 'POST',
      body: JSON.stringify(payloadFromForm(event.target)),
    });
    renderDecision('#sandboxDecision', result.simulated_decision);
    await loadAll();
  });

  dom('#quickTestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const decision = await api('/api/sandbox/evaluate', {
      method: 'POST',
      body: JSON.stringify(payloadFromForm(event.target)),
    });
    renderDecision('#quickDecision', decision);
  });
}

wireEvents();
loadAll().catch((error) => {
  setStatus(false, 'Error cargando');
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${escapeHtml(error.message)}</pre>`);
});
