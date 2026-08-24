const state = {
  data: null,
  resources: {},
  readiness: null,
};

const ruleLabels = {
  agent_request_handoff: {
    title: 'Agent or call request',
    plain: 'If someone says call me, agent, showing, ASAP, or appointment, Ana must stop and route to handoff.',
  },
  frustration_human_review: {
    title: 'Frustrated or hostile lead',
    plain: 'If the lead is frustrated, insulting, or threatening to leave for another agent, Ana stops replying.',
  },
  no_listing_promise: {
    title: 'No listing promises',
    plain: 'Ana cannot say it will send listings or options unless a real listing integration exists.',
  },
  short_term_airbnb: {
    title: 'Airbnb / short term',
    plain: 'If the lead is looking for Airbnb, furnished, or under 12 months, Ana must be honest and stop the normal cadence.',
  },
  stop_after_handoff: {
    title: 'Stop after handoff',
    plain: 'Once the lead is handed off or qualified, Ana should not keep replying.',
  },
  respect_no_call: {
    title: 'Respect no-call preference',
    plain: 'If the lead says they do not want a call, Ana should not ask for one again.',
  },
};

const actionOptions = [
  ['handoff', 'Send to Human'],
  ['mark_qualified', 'Mark Qualified'],
  ['notify_slack', 'Notify Slack'],
  ['stop_cadence', 'Stop Cadence'],
  ['block_reply', 'Block Reply'],
  ['human_review', 'Human Review'],
  ['mark_unqualified', 'Mark Unqualified'],
  ['allow_reply', 'Allow Reply'],
];

const channelOptions = [
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['call', 'Call'],
];

const promptOptions = [
  ['sms_inbound_decision', 'Inbound SMS Decision'],
  ['email_inbound_decision', 'Inbound Email Decision'],
  ['call_result_decision', 'Call Decision'],
  ['first_touch_sms', 'First Touch SMS'],
  ['first_touch_email', 'First Touch Email'],
  ['airbnb_short_term_email', 'Airbnb / Short Term'],
  ['round2_sms', 'Day 2 SMS'],
  ['round2_email', 'Day 2 Email'],
  ['final_exit_email', 'Final Exit Email'],
];

const ana2ActionLabels = {
  continue_qualification: 'Continue Qualification',
  qualified_handoff: 'Qualified + handoff',
  handoff_review: 'Handoff Review',
  human_review: 'Human Review',
  budget_review: 'Budget Review',
  short_term_unqualified: 'Short Term Not Qualified',
  opt_out: 'Opt out',
  log_only: 'Log Only',
};

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
  dom('#confirmMessage').textContent = message || 'You are about to change an Ana setting.';
  const dialog = dom('#confirmDialog');
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
  });
}

function money(value) {
  if (!value) return 'No limit';
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

function selected(current, value) {
  return current === value ? 'selected' : '';
}

function slugify(value) {
  return String(value || 'item')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'item';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cadenceStepLabel(stepNumber) {
  const labels = {
    1: 'Day 1',
    2: 'Day 2',
    3: 'Final Exit',
  };
  return labels[Number(stepNumber)] || `Step ${stepNumber}`;
}

function delayLabel(minutes) {
  const value = Number(minutes || 0);
  if (value === 0) return 'Immediate';
  if (value % 1440 === 0) return `${value / 1440} day${value / 1440 === 1 ? '' : 's'}`;
  if (value % 60 === 0) return `${value / 60} hour${value / 60 === 1 ? '' : 's'}`;
  return `${value} min`;
}

function renderDecision(target, decision) {
  const actionTitles = {
    handoff: 'Immediate Handoff',
    human_review: 'Human Review',
    mark_unqualified: 'Not Qualified',
    budget_review: 'Budget Review',
    continue_qualification: 'Continue Qualification',
    respect_channel_preference: 'Respect Channel Preference',
    short_term_unqualified: 'Short Term Not Qualified',
    qualified_handoff: 'Qualified + handoff',
    handoff_review: 'Handoff Review',
    log_only: 'Log Only',
    opt_out: 'Opt out',
  };
  const stopFlag = decision.stop_ai ?? decision.stop_cadence ?? false;
  const slackFlag = decision.should_notify_slack ?? decision.send_slack ?? false;

  dom(target).innerHTML = `
    <div class="decision-top">
      <span class="decision-action">${actionTitles[decision.action] || decision.action}</span>
      ${statusPill(!stopFlag)}
    </div>
    <div class="decision-grid">
      <div><small>Ana Replies</small><strong>${decision.should_reply ? 'Yes' : 'No'}</strong></div>
      <div><small>Qualified</small><strong>${decision.qualified ? 'Yes' : 'No'}</strong></div>
      <div><small>Slack</small><strong>${slackFlag ? 'Yes' : 'No'}</strong></div>
      <div><small>Stop</small><strong>${stopFlag ? 'Yes' : 'No'}</strong></div>
    </div>
    <p>${escapeHtml(decision.reason || 'No reason recorded.')}</p>
    <details>
      <summary>View Technical JSON</summary>
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
  const ana2Contacts = data.ana2Contacts?.length || 0;
  const outboxDrafts = (data.ana2Outbox || []).filter((item) => item.status === 'draft').length;
  const recentDecisions = data.ana2Decisions?.length || 0;
  dom('#metricGrid').innerHTML = `
    <article class="metric"><span>${activeRules}</span><p>Active Rules</p></article>
    <article class="metric"><span>${ana2Contacts}</span><p>Ana 2.0 Contacts</p></article>
    <article class="metric"><span>${outboxDrafts}</span><p>Outbox Drafts</p></article>
    <article class="metric"><span>${recentDecisions}</span><p>Audited Decisions</p></article>
  `;
}

function renderDashboard() {
  renderSystemStrip();
  renderMetrics();
  dom('#criticalRules').innerHTML = state.data.rules.slice(0, 6).map((rule) => `
    <div class="summary-row">
      <div>
        <strong>${escapeHtml(ruleLabels[rule.key]?.title || rule.name_en || rule.name_es)}</strong>
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

function renderLaunch() {
  const readiness = state.readiness || {};
  const safety = readiness.safety || {};
  const counts = readiness.counts || {};
  const triggerTag = readiness.trigger_tag || 'Ana 2.0 Test';
  dom('#triggerTagTitle').textContent = triggerTag;
  const live = readiness.status === 'live_sends_enabled';
  dom('#launchStatus').textContent = live ? 'LIVE SENDS ON' : 'SANDBOX SAFE';
  dom('#launchStatus').className = `launch-status ${live ? 'live' : 'sandbox'}`;
  dom('#readinessPanel').innerHTML = `
    <div><small>Mode</small><strong>${escapeHtml(safety.mode || 'sandbox')}</strong></div>
    <div><small>Real Sends</small><strong>${safety.real_sends_enabled ? 'Enabled' : 'Blocked'}</strong></div>
    <div><small>FUB Writes</small><strong>${safety.fub_writes_enabled ? 'Enabled' : 'Blocked'}</strong></div>
    <div><small>Contacts</small><strong>${counts.contacts || 0}</strong></div>
    <div><small>Drafts</small><strong>${counts.drafts || 0}</strong></div>
    <div><small>Decisions</small><strong>${counts.decisions || 0}</strong></div>
  `;

  const contacts = state.data.ana2Contacts || [];
  dom('#launchContacts').innerHTML = contacts.length ? contacts.slice(0, 8).map((contact) => `
    <article class="launch-contact">
      <div>
        <strong>${escapeHtml(contact.name || contact.person_id || 'Sandbox lead')}</strong>
        <span>${escapeHtml(contact.lead_type)} · ${escapeHtml(contact.status)} · ${escapeHtml(contact.person_id || '')}</span>
      </div>
      <button class="button primary" data-start-cadence="${contact.id}">Start Day 1</button>
    </article>
  `).join('') : '<div class="empty">Create the first pilot contact, then start Day 1.</div>';
}

function renderSystem() {
  dom('#systemControls').innerHTML = (state.data.emergency || []).map((control) => `
    <article class="control-card ${control.enabled ? '' : 'danger-zone'}">
      <div>
        <h3>${escapeHtml(control.label_en || control.label_es || control.key)}</h3>
        <p>${control.scope === 'system' ? 'Global control' : `${control.scope.toUpperCase()} channel`}</p>
      </div>
      <label class="toggle">
        <input type="checkbox" data-resource="emergency" data-id="${control.id}" data-field="enabled" ${control.enabled ? 'checked' : ''} />
        <span></span>
      </label>
    </article>
  `).join('');
  renderSettings();
}

function settingValue(key, fallback = {}) {
  return (state.data.settings || []).find((setting) => setting.key === key)?.value || fallback;
}

function renderSettings() {
  const form = dom('#ana2SettingsForm');
  if (!form) return;
  const budgetCap = settingValue('qualified_budget_cap', { buyer_seller_max: 2000000 });
  const renterMinLease = settingValue('renter_min_lease_months', { value: 12 });
  const triggerTag = settingValue('ana2_trigger_tag', { value: 'Ana 2.0 Test' });
  const safety = settingValue('ana2_safety_mode', { mode: 'sandbox', real_sends_enabled: false, fub_writes_enabled: false });
  form.innerHTML = `
    <div class="form-row">
      <label>Buyer/Seller max budget
        <input name="buyer_seller_max" type="number" value="${escapeHtml(budgetCap.buyer_seller_max ?? 2000000)}" />
      </label>
      <label>Renter minimum lease months
        <input name="renter_min_lease_months" type="number" value="${escapeHtml(renterMinLease.value ?? 12)}" />
      </label>
    </div>
    <div class="form-row">
      <label>Sandbox trigger tag
        <input name="ana2_trigger_tag" value="${escapeHtml(triggerTag.value || 'Ana 2.0 Test')}" />
      </label>
      <label>Mode
        <select name="ana2_mode">
          <option value="sandbox" ${selected(safety.mode, 'sandbox')}>Sandbox</option>
          <option value="production" ${selected(safety.mode, 'production')}>Production</option>
        </select>
      </label>
    </div>
    <div class="action-grid">
      <label class="check-chip">
        <input type="checkbox" name="real_sends_enabled" value="true" ${safety.real_sends_enabled ? 'checked' : ''} />
        <span>Allow Real Sends</span>
      </label>
      <label class="check-chip">
        <input type="checkbox" name="fub_writes_enabled" value="true" ${safety.fub_writes_enabled ? 'checked' : ''} />
        <span>Allow FUB Writes</span>
      </label>
    </div>
    <div class="form-footer">
      <span>Recommended now: sandbox, real sends OFF, FUB writes OFF.</span>
      <button class="button primary">Save Ana 2.0 Settings</button>
    </div>
  `;
}

function renderRules() {
  const createCard = `
    <article class="operator-card create-card">
      <div class="operator-head">
        <div>
          <h3>New Rule</h3>
          <p>Create a simple condition Ana can evaluate before replying.</p>
        </div>
      </div>
      <form class="operator-form" data-create-resource="rules">
        <div class="form-row">
          <label>Rule Name<input name="name_en" placeholder="Example: Lead wants a tour today" required /></label>
          <label>Priority<input name="priority" type="number" value="90" /></label>
        </div>
        <label>Comma-separated phrases / signals
          <textarea name="phrases" placeholder="tour today, showing, wants to see the property"></textarea>
        </label>
        <div class="action-grid">
          ${actionOptions.map(([value, label]) => `
            <label class="check-chip">
              <input type="checkbox" name="actions" value="${value}" ${checked(['human_review'], value)} />
              <span>${label}</span>
            </label>
          `).join('')}
        </div>
        <div class="form-footer">
          <span>The rule is active by default and requires confirmation.</span>
          <button class="button primary">Create Rule</button>
        </div>
      </form>
    </article>
  `;

  const cards = state.data.rules.map((rule) => `
    <article class="operator-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(ruleLabels[rule.key]?.title || rule.name_en || rule.name_es)}</h3>
          <p>${escapeHtml(ruleLabels[rule.key]?.plain || rule.notes_en || rule.notes_es || '')}</p>
        </div>
        <label class="toggle">
          <input type="checkbox" data-resource="rules" data-id="${rule.id}" data-field="enabled" ${rule.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="rules" data-id="${rule.id}">
        <label>Phrases / signals that trigger this rule
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
          <span>Priority ${rule.priority} · ${rule.severity}</span>
          <button class="button primary">Save Rule</button>
        </div>
      </form>
    </article>
  `).join('');

  dom('#ruleCards').innerHTML = createCard + cards;
}

function renderCadences() {
  const actionsByCadence = (state.data.cadenceActions || []).reduce((groups, action) => {
    groups[action.cadence_id] ||= [];
    groups[action.cadence_id].push(action);
    return groups;
  }, {});
  dom('#cadenceCards').innerHTML = state.data.cadences.map((cadence) => {
    const actions = (actionsByCadence[cadence.id] || []).sort((a, b) => a.round_number - b.round_number || a.action_order - b.action_order);
    const rounds = actions.reduce((groups, action) => {
      groups[action.round_number] ||= [];
      groups[action.round_number].push(action);
      return groups;
    }, {});
    return `
      <article class="operator-card">
        <div class="operator-head">
          <div>
            <h3>${cadence.lead_type.toUpperCase()}</h3>
            <p>${escapeHtml(cadence.name_en || cadence.name_es)} · Round 1 email/SMS/call, Round 2 email/SMS/call, Round 3 final exit.</p>
          </div>
          <label class="toggle">
            <input type="checkbox" data-resource="cadences" data-id="${cadence.id}" data-field="enabled" ${cadence.enabled ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
        <form class="operator-form" data-resource="cadences" data-id="${cadence.id}">
          <div class="form-row">
            <label>Minimum Budget<input name="min_budget" type="number" value="${cadence.min_budget || ''}" placeholder="no minimum" /></label>
            <label>Maximum Budget<input name="max_budget" type="number" value="${cadence.max_budget || ''}" placeholder="no maximum" /></label>
          </div>
          <div class="budget-note">Rango actual: ${money(cadence.min_budget)} a ${money(cadence.max_budget)}</div>
          <div class="form-footer">
            <span>Stop: replied, qualified, handed off, review</span>
            <button class="button primary">Save Cadence</button>
          </div>
        </form>
        <div class="round-grid">
          ${[1, 2, 3].map((round) => `
            <section class="round-card">
              <div class="round-title">
                <strong>${round === 3 ? 'Day 3' : `Day ${round}`}</strong>
                <span>${round === 3 ? 'Final exit' : 'Email + SMS + call'}</span>
              </div>
              <div class="step-list">
                ${(rounds[round] || []).map((action) => `
                  <form class="step-editor" data-resource="cadenceActions" data-id="${action.id}">
                    <div>
                      <strong>${escapeHtml(action.label_en || action.label_es || `${action.channel} ${action.action_order}`)}</strong>
                      <small>${delayLabel(action.delay_minutes)} · ${action.channel.toUpperCase()}</small>
                    </div>
                    <label>Channel
                      <select name="channel">
                        ${channelOptions.map(([value, label]) => `<option value="${value}" ${selected(action.channel, value)}>${label}</option>`).join('')}
                      </select>
                    </label>
                    <label>Delay Minutes
                      <input name="delay_minutes" type="number" value="${action.delay_minutes || 0}" />
                    </label>
                    <label>Prompt
                      <select name="prompt_key">
                        ${promptOptions.map(([value, label]) => `<option value="${value}" ${selected(action.prompt_key, value)}>${label}</option>`).join('')}
                      </select>
                    </label>
                    <label class="toggle">
                      <input type="checkbox" data-resource="cadenceActions" data-id="${action.id}" data-field="enabled" ${action.enabled ? 'checked' : ''} />
                      <span></span>
                    </label>
                    <button class="button secondary">Save</button>
                  </form>
                `).join('') || '<p class="empty">No actions for this round.</p>'}
              </div>
            </section>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderPrompts() {
  const createCard = `
    <article class="operator-card create-card">
      <div class="operator-head">
        <div>
          <h3>New Prompt</h3>
          <p>Create reusable text for SMS, email, calls, or system-level rules.</p>
        </div>
      </div>
      <form class="operator-form" data-create-resource="prompts">
        <div class="form-row">
          <label>Name<input name="name_en" placeholder="Example: Day 2 renter follow-up" required /></label>
          <label>Channel
            <select name="channel">
              ${channelOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </label>
        </div>
        <label>Prompt
          <textarea name="prompt_text" class="prompt-box" placeholder="Write the exact instruction Ana should use."></textarea>
        </label>
        <button class="button primary">Create Prompt</button>
      </form>
    </article>
  `;

  const cards = state.data.prompts.map((prompt) => `
    <article class="operator-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(prompt.name_en || prompt.name_es)}</h3>
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
          <span>This text becomes the central source for n8n once the sandbox is wired.</span>
          <button class="button primary">Save Prompt</button>
        </div>
      </form>
    </article>
  `).join('');

  dom('#promptCards').innerHTML = createCard + cards;
}

function renderProviders() {
  dom('#channelCards').innerHTML = state.data.channels.map((channel) => `
    <article class="operator-card compact">
      <div class="operator-head">
        <div><h3>${channel.channel.toUpperCase()}</h3><p>Max auto replies: ${channel.max_auto_replies_per_conversation}</p></div>
        <label class="toggle">
          <input type="checkbox" data-resource="channels" data-id="${channel.id}" data-field="enabled" ${channel.enabled ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <form class="operator-form" data-resource="channels" data-id="${channel.id}">
        <label>Max Automatic Replies<input name="max_auto_replies_per_conversation" type="number" value="${channel.max_auto_replies_per_conversation}" /></label>
        <button class="button primary">Save Channel</button>
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
        <label>Display Name<input name="name" value="${escapeHtml(provider.name)}" /></label>
        <label>Notes<textarea name="notes">${escapeHtml(provider.notes || '')}</textarea></label>
        <button class="button primary">Save Provider</button>
      </form>
    </article>
  `).join('');
}

function renderSlack() {
  const createCard = `
    <article class="operator-card create-card">
      <div class="operator-head">
        <div>
          <h3>New Slack Route</h3>
          <p>Define where qualified, handoff, error, or human-review events should go.</p>
        </div>
      </div>
      <form class="operator-form" data-create-resource="slack">
        <div class="form-row">
          <label>Display Name<input name="channel_label" placeholder="Buyer/Seller Channel" required /></label>
          <label>Webhook secret/env key<input name="webhook_secret_key" placeholder="SLACK_BUYER_SELLER_WEBHOOK" required /></label>
        </div>
        <div class="form-row">
          <label>Lead types<input name="lead_types" value="buyer, seller" /></label>
          <label>Events<input name="event_types" value="qualified, handoff" /></label>
        </div>
        <label>Notes<textarea name="notes" placeholder="What this route is used for."></textarea></label>
        <button class="button primary">Create Slack Route</button>
      </form>
    </article>
  `;

  const cards = state.data.slack.map((route) => `
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
          <label>Display Name<input name="channel_label" value="${escapeHtml(route.channel_label || '')}" /></label>
          <label>Lead types<input name="lead_types" value="${escapeHtml(toArray(route.lead_types).join(', '))}" /></label>
        </div>
        <div class="form-row">
          <label>Events<input name="event_types" value="${escapeHtml(toArray(route.event_types).join(', '))}" /></label>
          <label>Webhook secret/env key<input name="webhook_secret_key" value="${escapeHtml(route.webhook_secret_key || '')}" /></label>
        </div>
        <label>Notes<textarea name="notes">${escapeHtml(route.notes || '')}</textarea></label>
        <button class="button primary">Save Slack Route</button>
      </form>
    </article>
  `).join('');

  dom('#slackCards').innerHTML = createCard + cards;
}

function renderAna2() {
  const contacts = state.data.ana2Contacts || [];
  const decisions = state.data.ana2Decisions || [];
  const select = dom('#ana2ContactSelect');
  if (select) {
    select.innerHTML = contacts.length ? contacts.map((contact) => `
      <option value="${contact.id}">${escapeHtml(contact.name || contact.person_id || contact.email || contact.id)} · ${escapeHtml(contact.lead_type)}</option>
    `).join('') : '<option value="">Create a contact first</option>';
  }

  dom('#ana2Contacts').innerHTML = contacts.length ? contacts.map((contact) => `
    <div class="contact-row" data-contact-id="${contact.id}">
      <div>
        <strong>${escapeHtml(contact.name || contact.person_id || 'Lead test')}</strong>
        <span>${escapeHtml(contact.lead_type)} · ${escapeHtml(contact.status)} · ${escapeHtml(contact.trigger_tag || '')}</span>
      </div>
      <div class="mini-pills">
        ${statusPill(contact.mode === 'sandbox')}
        <button class="button secondary" data-start-cadence="${contact.id}">Start Day 1</button>
      </div>
    </div>
  `).join('') : '<div class="empty">Create the first sandbox contact.</div>';

  dom('#ana2Decisions').innerHTML = decisions.length ? decisions.slice(0, 12).map((decision) => `
    <article class="decision-row">
      <div>
        <strong>${escapeHtml(ana2ActionLabels[decision.action] || decision.action)}</strong>
        <span>${escapeHtml(decision.reason || '')}</span>
      </div>
      <div class="mini-pills">
        ${statusPill(decision.qualified)}
        <small>${escapeHtml(decision.channel)} · ${new Date(decision.created_at).toLocaleString()}</small>
      </div>
    </article>
  `).join('') : '<div class="empty">No Ana 2.0 decisions yet.</div>';
}

function renderAna2Outbox() {
  const outbox = state.data.ana2Outbox || [];
  dom('#ana2Outbox').innerHTML = outbox.length ? outbox.map((item) => `
    <article class="operator-card outbox-card">
      <div class="operator-head">
        <div>
          <h3>${escapeHtml(item.channel.toUpperCase())} draft</h3>
          <p>${escapeHtml(item.status)} · ${new Date(item.created_at).toLocaleString()}</p>
        </div>
        ${statusPill(item.status === 'draft')}
      </div>
      <form class="operator-form" data-outbox-id="${item.id}">
        <label>Message
          <textarea name="body">${escapeHtml(item.body || '')}</textarea>
        </label>
        <div class="form-row">
          <label>Status
            <select name="status">
              ${['draft', 'approved', 'blocked', 'sent'].map((status) => `<option value="${status}" ${selected(item.status, status)}>${status}</option>`).join('')}
            </select>
          </label>
          <label>Scheduled For<input name="scheduled_for" value="${escapeHtml(item.scheduled_for || '')}" placeholder="optional" /></label>
        </div>
        <button class="button primary">Save Outbox</button>
      </form>
    </article>
  `).join('') : '<div class="empty">No drafts yet. Simulate an inbound message in Ana 2.0.</div>';
}

function renderTables() {
  renderTable('#testsList', state.data.tests || [], ['created_at', 'first_name', 'lead_type', 'channel', 'message', 'status']);
  renderTable('#logsList', [...(state.data.decisions || []), ...(state.data.errors || [])], ['created_at', 'channel', 'person_id', 'status', 'reason', 'message']);
}

function renderTable(target, rows, fields) {
  if (!rows.length) {
    dom(target).innerHTML = '<div class="empty">No records yet.</div>';
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
  const resource = form.dataset.resource || form.dataset.createResource;

  if (resource === 'rules') {
    const actions = data.getAll('actions');
    const phrases = String(payload.phrases || '').split(',').map((item) => item.trim()).filter(Boolean);
    delete payload.phrases;
    payload.key ||= slugify(payload.name_en || payload.name_es);
    payload.actions = actions;
    payload.conditions = { phrases };
    payload.name_es ||= payload.name_en;
    payload.notes_en ||= '';
    payload.notes_es ||= payload.notes_en;
  }

  if (resource === 'prompts') {
    payload.key ||= slugify(payload.name_en || payload.name_es);
    payload.name_es ||= payload.name_en;
    payload.output_contract ||= {};
  }

  if (resource === 'slack') {
    payload.name ||= slugify(payload.channel_label || 'slack_route');
  }

  ['lead_types', 'event_types'].forEach((field) => {
    if (payload[field]) payload[field] = payload[field].split(',').map((item) => item.trim()).filter(Boolean);
  });

  ['min_budget', 'max_budget', 'max_auto_replies_per_conversation', 'delay_minutes', 'step_number', 'priority', 'budget', 'monthly_rent', 'lease_months'].forEach((field) => {
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

async function create(resource, payload) {
  await api(`/api/${resource}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function setStatus(ok, text) {
  dom('#syncDot').className = ok ? 'ok' : 'bad';
  dom('#syncText').textContent = text;
}

async function loadAll() {
  const [dashboard, prompts, channels, readiness] = await Promise.all([
    api('/api/dashboard'),
    api('/api/prompts'),
    api('/api/channels'),
    api('/api/ana2/readiness'),
  ]);
  state.data = dashboard;
  state.data.prompts = prompts;
  state.data.channels = channels;
  state.readiness = readiness;
  renderLaunch();
  renderDashboard();
  renderSystem();
  renderRules();
  renderCadences();
  renderPrompts();
  renderProviders();
  renderSlack();
  renderAna2();
  renderAna2Outbox();
  renderTables();
  setStatus(true, 'System loaded');
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

  document.body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-start-cadence]');
    if (!button) return;
    if (!(await confirmChange('Create Day 1 Ana 2.0 drafts for this contact. In sandbox, nothing is sent.'))) return;
    await api(`/api/ana2/contacts/${button.dataset.startCadence}/start-cadence`, {
      method: 'POST',
      body: JSON.stringify({ round: 1 }),
    });
    await loadAll();
    activate('outbox');
  });

  dom('#refreshButton').addEventListener('click', loadAll);
  dom('#seedButton').addEventListener('click', async () => {
    if (!(await confirmChange('This will load Ana base configuration when records are missing.'))) return;
    await api('/api/seed-defaults', { method: 'POST', body: '{}' });
    await loadAll();
  });

  document.body.addEventListener('change', async (event) => {
    const input = event.target.closest('input[data-resource][data-field]');
    if (!input) return;
    const label = input.checked ? 'enable' : 'disable';
    if (!(await confirmChange(`Confirm ${label} this control.`))) {
      input.checked = !input.checked;
      return;
    }
    await patch(input.dataset.resource, input.dataset.id, { [input.dataset.field]: input.checked });
    await loadAll();
  });

  document.body.addEventListener('submit', async (event) => {
    if (event.target.id === 'ana2SettingsForm') {
      event.preventDefault();
      if (!(await confirmChange('Save Ana 2.0 base settings.'))) return;
      const data = new FormData(event.target);
      await Promise.all([
        api('/api/settings/qualified_budget_cap', {
          method: 'PATCH',
          body: JSON.stringify({ value: { buyer_seller_max: Number(data.get('buyer_seller_max') || 2000000) } }),
        }),
        api('/api/settings/renter_min_lease_months', {
          method: 'PATCH',
          body: JSON.stringify({ value: { value: Number(data.get('renter_min_lease_months') || 12) } }),
        }),
        api('/api/settings/ana2_trigger_tag', {
          method: 'PATCH',
          body: JSON.stringify({ value: { value: data.get('ana2_trigger_tag') || 'Ana 2.0 Test' } }),
        }),
        api('/api/settings/ana2_safety_mode', {
          method: 'PATCH',
          body: JSON.stringify({
            value: {
              mode: data.get('ana2_mode') || 'sandbox',
              real_sends_enabled: data.has('real_sends_enabled'),
              fub_writes_enabled: data.has('fub_writes_enabled'),
            },
          }),
        }),
      ]);
      await loadAll();
      return;
    }

    if (event.target.id === 'ana2ContactForm') {
      event.preventDefault();
      if (!(await confirmChange('Create or update this Ana 2.0 sandbox contact.'))) return;
      await api('/api/ana2/contacts', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm(event.target)),
      });
      await loadAll();
      return;
    }

    if (event.target.id === 'launchContactForm') {
      event.preventDefault();
      if (!(await confirmChange('Create this Ana 2.0 pilot contact.'))) return;
      await api('/api/ana2/contacts', {
        method: 'POST',
        body: JSON.stringify(payloadFromForm(event.target)),
      });
      await loadAll();
      return;
    }

    if (event.target.id === 'ana2MessageForm') {
      event.preventDefault();
      const payload = payloadFromForm(event.target);
      if (!payload.contact_id) return;
      const result = await api(`/api/ana2/contacts/${payload.contact_id}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      renderDecision('#ana2Decision', result.decision.decision || result.decision);
      await loadAll();
      return;
    }

    const outboxForm = event.target.closest('form[data-outbox-id]');
    if (outboxForm) {
      event.preventDefault();
      if (!(await confirmChange('Save this Ana 2.0 draft.'))) return;
      await api(`/api/ana2/outbox/${outboxForm.dataset.outboxId}`, {
        method: 'PATCH',
        body: JSON.stringify(payloadFromForm(outboxForm)),
      });
      await loadAll();
      return;
    }

    const createForm = event.target.closest('form[data-create-resource]');
    if (createForm) {
      event.preventDefault();
      if (!(await confirmChange('Create this new Ana Manager control.'))) return;
      await create(createForm.dataset.createResource, payloadFromForm(createForm));
      createForm.reset();
      await loadAll();
      return;
    }

    const form = event.target.closest('form[data-resource]');
    if (!form) return;
    event.preventDefault();
    if (!(await confirmChange('Save this change in Ana Manager.'))) return;
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
  setStatus(false, 'Loading error');
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">${escapeHtml(error.message)}</pre>`);
});
