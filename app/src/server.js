import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const resources = {
  emergency: {
    table: 'asm_emergency_controls',
    fields: ['key', 'label_en', 'label_es', 'scope', 'enabled', 'reason'],
    order: 'scope, label_es',
  },
  rules: {
    table: 'asm_rules',
    fields: ['key', 'name_en', 'name_es', 'enabled', 'priority', 'severity', 'applies_to_channels', 'applies_to_lead_types', 'conditions', 'actions', 'confirmation_required', 'notes_en', 'notes_es'],
    order: 'priority ASC, name_es ASC',
  },
  cadences: {
    table: 'asm_cadences',
    fields: ['key', 'name_en', 'name_es', 'lead_type', 'enabled', 'max_budget', 'min_budget', 'stop_conditions'],
    order: 'lead_type ASC, name_es ASC',
  },
  prompts: {
    table: 'asm_prompts',
    fields: ['key', 'name_en', 'name_es', 'channel', 'version', 'enabled', 'prompt_text', 'output_contract'],
    order: 'channel ASC, name_es ASC',
  },
  providers: {
    table: 'asm_providers',
    fields: ['name', 'kind', 'provider_code', 'enabled', 'is_primary', 'config', 'notes'],
    order: 'kind ASC, name ASC',
  },
  channels: {
    table: 'asm_channels',
    fields: ['channel', 'enabled', 'max_auto_replies_per_conversation', 'quiet_hours'],
    order: 'channel ASC',
  },
  slack: {
    table: 'asm_slack_routes',
    fields: ['name', 'enabled', 'lead_types', 'event_types', 'webhook_secret_key', 'channel_label', 'notes'],
    order: 'name ASC',
  },
  workflows: {
    table: 'asm_workflow_modules',
    fields: ['name', 'n8n_workflow_id', 'module_type', 'enabled', 'current_role', 'migration_status', 'control_surface', 'notes'],
    order: 'module_type ASC, name ASC',
  },
};

const defaultSeeds = {
  settings: `
    INSERT INTO asm_system_settings (key, label_en, label_es, value, description_en, description_es) VALUES
    ('ui_language_default', 'Default UI Language', 'Idioma por defecto', '{"value":"es"}', 'Default manager language.', 'Idioma inicial del panel.'),
    ('qualified_budget_cap', 'Qualified Budget Cap', 'Presupuesto maximo qualified', '{"buyer_seller_max":2000000}', 'Maximum budget for buyer/seller qualified routing.', 'Presupuesto maximo para enrutar buyer/seller como qualified.'),
    ('one_slack_per_last_in_sid', 'One Slack per Last In SID', 'Un Slack por Last In SID', '{"enabled":true}', 'Prevent duplicate Slack alerts for the same inbound message.', 'Evita duplicados de Slack para el mismo mensaje entrante.')
    ON CONFLICT (key) DO NOTHING
  `,
  emergency: `
    INSERT INTO asm_emergency_controls (key, label_en, label_es, scope, enabled) VALUES
    ('all_systems', 'All Ana Automation', 'Toda la automatizacion Ana', 'system', true),
    ('cadences', 'Cadences', 'Cadencias', 'system', true),
    ('sms_channel', 'SMS Channel', 'Canal SMS', 'sms', true),
    ('email_channel', 'Email Channel', 'Canal Email', 'email', true),
    ('call_channel', 'Call Channel', 'Canal llamadas', 'call', true)
    ON CONFLICT (key) DO NOTHING
  `,
  providers: `
    INSERT INTO asm_providers (name, kind, provider_code, enabled, is_primary, config, notes) VALUES
    ('Twilio SMS', 'sms', 'twilio', true, true, '{"credential_source":"n8n"}', 'Current SMS provider.'),
    ('Gmail Email', 'email', 'gmail', true, true, '{"credential_source":"n8n"}', 'Current email provider.'),
    ('Retell Voice', 'voice', 'retell', true, true, '{"credential_source":"n8n"}', 'Current voice AI provider.'),
    ('Follow Up Boss', 'crm', 'follow_up_boss', true, true, '{"credential_source":"n8n"}', 'Primary CRM.'),
    ('Airtable', 'database', 'airtable', true, false, '{"credential_source":"n8n"}', 'Operational review table.'),
    ('OpenAI', 'ai', 'openai', true, true, '{"credential_source":"n8n"}', 'Current LLM provider.')
    ON CONFLICT (kind, provider_code) DO NOTHING
  `,
  channels: `
    INSERT INTO asm_channels (channel, enabled, max_auto_replies_per_conversation) VALUES
    ('sms', true, 3),
    ('email', true, 3),
    ('call', true, 1)
    ON CONFLICT (channel) DO NOTHING
  `,
  slack: `
    INSERT INTO asm_slack_routes (name, enabled, lead_types, event_types, webhook_secret_key, channel_label, notes) VALUES
    ('buyer_seller_qualified', true, ARRAY['buyer','seller'], ARRAY['qualified','handoff'], 'SLACK_BUYER_SELLER_WEBHOOK', 'Buyer/Seller Channel', 'High-value buyer/seller qualified alerts.'),
    ('general_qualified', true, ARRAY['renter','landlord','unknown'], ARRAY['qualified','handoff'], 'SLACK_GENERAL_WEBHOOK', 'General Channel', 'Default qualified alerts.'),
    ('errors', true, ARRAY['buyer','seller','renter','landlord','unknown'], ARRAY['error','human_review'], 'SLACK_ERRORS_WEBHOOK', 'System Errors', 'Operational errors and review alerts.')
    ON CONFLICT (name) DO NOTHING
  `,
  prompts: `
    INSERT INTO asm_prompts (key, name_en, name_es, channel, prompt_text, output_contract) VALUES
    ('sms_inbound_decision', 'SMS Inbound Decision', 'Decision SMS entrante', 'sms', 'Classify the inbound SMS and return only JSON. Never promise listings unless listing_search_available is true.', '{"format":"json","required":["action","should_reply","qualified","stop_ai","reason"]}'),
    ('email_inbound_decision', 'Email Inbound Decision', 'Decision email entrante', 'email', 'Classify the inbound email and return only JSON. Escalate agent requests and frustration.', '{"format":"json","required":["action","should_reply","qualified","stop_ai","reason"]}'),
    ('call_result_decision', 'Call Result Decision', 'Decision resultado llamada', 'call', 'Classify the call result and return only JSON for qualification, tags, Slack, and next steps.', '{"format":"json","required":["action","qualified","stop_ai","reason"]}'),
    ('first_touch_sms', 'First Touch SMS', 'Primer toque SMS', 'sms', 'Write the first SMS touch for the lead type. Keep it short, honest, and never offer listings unless available.', '{"format":"text"}'),
    ('first_touch_email', 'First Touch Email', 'Primer toque email', 'email', 'Write the first email touch for the lead type. Keep it clear, human, and compliant.', '{"format":"text"}'),
    ('airbnb_short_term_email', 'Airbnb / Short-Term Email', 'Correo Airbnb / corto plazo', 'email', 'Tell the lead we mainly handle traditional real estate and may not be the best fit for short-term or Airbnb-style rentals. Do not promise listings.', '{"format":"text"}')
    ON CONFLICT (key) DO NOTHING
  `,
  rules: `
    INSERT INTO asm_rules (key, name_en, name_es, priority, severity, conditions, actions, notes_en, notes_es) VALUES
    ('agent_request_handoff', 'Agent request means immediate handoff', 'Solicitud de agente significa handoff inmediato', 10, 'critical', '{"phrases":["call me","agent","asap","showing","appointment","today","tomorrow","llamame","llamar","agente","cita"]}', ARRAY['handoff','mark_qualified','notify_slack','stop_cadence'], 'Do not keep asking budget after an agent request.', 'No seguir pidiendo presupuesto despues de solicitud de agente.'),
    ('frustration_human_review', 'Frustration stops Ana', 'Frustracion detiene a Ana', 20, 'critical', '{"signals":["idiot","stop asking","another agent","angry","upset","stupid","fuck","mierda","idiota"]}', ARRAY['human_review','block_reply','stop_cadence','notify_slack'], 'Hostile/frustrated leads go to human review.', 'Leads molestos pasan a revision humana.'),
    ('no_listing_promise', 'Ana cannot promise listings', 'Ana no puede prometer listings', 30, 'high', '{"listing_search_available":false}', ARRAY['block_reply'], 'Block any reply promising listings/options when no listing integration exists.', 'Bloquear promesas de listings/opciones si no existe integracion.'),
    ('short_term_airbnb', 'Short-term/Airbnb is not a fit', 'Corto plazo/Airbnb no califica', 35, 'high', '{"phrases":["airbnb","short term","short-term","vacation rental","furnished","1 month","2 months","3 months","4 months","5 months","6 months"]}', ARRAY['mark_unqualified','stop_cadence'], 'Use honest short-term response and stop normal cadence.', 'Usar respuesta honesta de corto plazo y detener cadencia normal.'),
    ('stop_after_handoff', 'Stop AI after handoff', 'Detener IA despues del handoff', 40, 'critical', '{"lead_state":["qualified","handed_off"]}', ARRAY['block_reply','stop_cadence'], 'Avoid duplicate or post-handoff AI replies.', 'Evitar respuestas duplicadas o posteriores al handoff.'),
    ('respect_no_call', 'Respect no-call preference', 'Respetar preferencia sin llamada', 50, 'high', '{"phrases":["no call","dont call","do not call","text only","email only","no quiero llamada"]}', ARRAY['block_reply'], 'Do not ask for a call after no-call preference.', 'No pedir llamada si el lead dijo que no quiere llamada.')
    ON CONFLICT (key) DO NOTHING
  `,
  cadences: `
    INSERT INTO asm_cadences (key, name_en, name_es, lead_type, enabled, max_budget, min_budget, stop_conditions) VALUES
    ('buyer_default', 'Buyer Default Cadence', 'Cadencia buyer default', 'buyer', true, 2000000, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
    ('seller_default', 'Seller Default Cadence', 'Cadencia seller default', 'seller', true, 2000000, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
    ('renter_default', 'Renter Default Cadence', 'Cadencia renter default', 'renter', true, null, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
    ('landlord_default', 'Landlord Default Cadence', 'Cadencia landlord default', 'landlord', true, null, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}')
    ON CONFLICT (key) DO NOTHING
  `,
  workflows: `
    INSERT INTO asm_workflow_modules (key, name, n8n_workflow_id, module_type, enabled, current_role, migration_status, control_surface, notes) VALUES
    ('fub_ingestion', 'FUB Ingestion (General uses)', '7a8zKvuSGdvSdA3j', 'intake', true, 'Polls Follow Up Boss events, filters inquiries, registers leads in queue, applies Ana Auto tag.', 'observed', '{"controls":["lead_type_detection","budget_cap","auto_tag","non_lead_detection"]}', 'Current entry point for new FUB inquiries.'),
    ('dispatcher', 'BBP — Ana Motor de Seguimiento (Dispatcher)', 'tDAyougPHt31wsXM', 'dispatcher', true, 'Runs every 20 minutes, finds due leads, advances rounds, sends closing email on round 3.', 'observed', '{"controls":["schedule","due_formula","round_rules","closing_email"]}', 'Cadence orchestration layer.'),
    ('cadence_runner', 'BBP — Ana Cadence Runner', 'FSdIUZCQ3sB9stpa', 'cadence', true, 'Executes touch attempts by call, SMS and email; applies Ana touched tag after first real touch.', 'observed', '{"controls":["call_hours","sms_allowed","first_touch","ana_touched","recap_email"]}', 'Largest flow; primary target for centralizing cadence config.'),
    ('sms_inbound', 'BBP — Ana Inbound SMS', 'UvMU7F3rm6fpWQEc', 'inbound', true, 'Receives SMS, logs inbound, qualifies with AI, replies, routes handoff/review, Slack alert.', 'observed', '{"controls":["reaction_signal","handoff_stop","qualification","slack_route","dnc"]}', 'Primary SMS conversation flow.'),
    ('email_inbound', 'BBP — Ana Inbound Email', 'cTYOo8wU42xDMPj4', 'inbound', true, 'Receives email, logs inbound, checks DNC, qualifies with AI, replies, routes handoff/review.', 'observed', '{"controls":["qualification","handoff_stop","slack_route","dnc","html_reply"]}', 'Primary email conversation flow.'),
    ('call_result_handler', 'BBP - Call Result Handler', 'WCPsTiP9dWkNXVpG', 'call', true, 'Receives Retell analysis, logs call to FUB, marks called/qualified, applies handoff tag and Slack.', 'observed', '{"controls":["call_success","qualified","slack_route","handoff_tag"]}', 'Primary call result processing flow.')
    ON CONFLICT (key) DO NOTHING
  `,
};

async function ensureRuntimeSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_test_leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name text,
      last_name text,
      person_id text,
      phone text,
      email text,
      lead_type text NOT NULL DEFAULT 'unknown',
      channel asm_channel NOT NULL DEFAULT 'sms',
      message text NOT NULL,
      budget numeric,
      status text NOT NULL DEFAULT 'new',
      simulated_decision jsonb NOT NULL DEFAULT '{}'::jsonb,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_workflow_modules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      name text NOT NULL,
      n8n_workflow_id text,
      module_type text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      current_role text NOT NULL,
      migration_status text NOT NULL DEFAULT 'observed',
      control_surface jsonb NOT NULL DEFAULT '{}'::jsonb,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function seedDefaults() {
  for (const sql of Object.values(defaultSeeds)) {
    await pool.query(sql);
  }

  await pool.query(`
    INSERT INTO asm_cadence_steps (cadence_id, step_number, channel, delay_minutes, prompt_key, stop_if)
    SELECT id, 1, 'sms', 0, 'first_touch_sms', '{"replied":true,"qualified":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, step_number) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO asm_cadence_steps (cadence_id, step_number, channel, delay_minutes, prompt_key, stop_if)
    SELECT id, 2, 'email', 60, 'first_touch_email', '{"replied":true,"qualified":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, step_number) DO NOTHING
  `);
  await pool.query(`
    INSERT INTO asm_cadence_steps (cadence_id, step_number, channel, delay_minutes, prompt_key, stop_if)
    SELECT id, 3, 'call', 1440, 'call_result_decision', '{"replied":true,"qualified":true,"no_call":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, step_number) DO NOTHING
  `);
}

async function buildDecision(input) {
  const message = String(input.message || '').toLowerCase();
  const leadType = String(input.lead_type || 'unknown').toLowerCase();
  const channel = input.channel || 'sms';
  const budget = Number(input.budget || 0);
  const rules = await pool.query('select * from asm_rules where enabled = true order by priority asc');
  const settings = await pool.query("select value from asm_system_settings where key = 'qualified_budget_cap'");
  const cap = Number(settings.rows[0]?.value?.buyer_seller_max || 2000000);

  const base = {
    action: 'continue_qualification',
    should_reply: true,
    reply_type: `${channel}_followup`,
    qualified: false,
    should_notify_slack: false,
    stop_ai: false,
    matched_rules: [],
    reason: 'No hard stop matched. Ana can continue qualification.',
  };

  for (const rule of rules.rows) {
    const conditions = rule.conditions || {};
    const phrases = [...(conditions.phrases || []), ...(conditions.signals || [])].map((value) => String(value).toLowerCase());
    const matched = phrases.some((phrase) => message.includes(phrase));
    if (!matched && !['no_listing_promise', 'stop_after_handoff'].includes(rule.key)) continue;

    if (rule.key === 'agent_request_handoff') {
      return {
        action: 'handoff',
        should_reply: false,
        reply_type: null,
        qualified: true,
        should_notify_slack: true,
        stop_ai: true,
        matched_rules: [rule.key],
        reason: 'Lead asked for an agent/call/showing. Stop AI and notify human.',
      };
    }

    if (rule.key === 'frustration_human_review') {
      return {
        action: 'human_review',
        should_reply: false,
        reply_type: null,
        qualified: false,
        should_notify_slack: true,
        stop_ai: true,
        matched_rules: [rule.key],
        reason: 'Frustration or hostile language detected. Ana should stop.',
      };
    }

    if (rule.key === 'short_term_airbnb' && matched) {
      return {
        action: 'mark_unqualified',
        should_reply: true,
        reply_type: 'airbnb_short_term_email',
        qualified: false,
        should_notify_slack: false,
        stop_ai: true,
        matched_rules: [rule.key],
        reason: 'Lead appears to need short-term/Airbnb style rental.',
      };
    }

    if (rule.key === 'respect_no_call' && matched) {
      return {
        ...base,
        action: 'respect_channel_preference',
        reply_type: 'no_call_acknowledgement',
        matched_rules: [rule.key],
        reason: 'Lead does not want phone calls. Ana should not ask for calls.',
      };
    }
  }

  if (['buyer', 'seller'].includes(leadType) && budget > cap) {
    return {
      action: 'budget_review',
      should_reply: false,
      reply_type: null,
      qualified: false,
      should_notify_slack: true,
      stop_ai: true,
      matched_rules: ['qualified_budget_cap'],
      reason: `Budget ${budget} is above configured cap ${cap}. Send to review.`,
    };
  }

  return base;
}

function basicAuth(req, res, next) {
  const user = process.env.MANAGER_BASIC_USER;
  const pass = process.env.MANAGER_BASIC_PASSWORD;
  if (!user || !pass) return next();

  const header = req.headers.authorization || '';
  const [scheme, value] = header.split(' ');
  if (scheme === 'Basic' && value) {
    const [providedUser, providedPass] = Buffer.from(value, 'base64').toString('utf8').split(':');
    if (providedUser === user && providedPass === pass) return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Ana System Manager"');
  res.status(401).send('Authentication required');
}

function pickPayload(body, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  );
}

function normalizeJsonFields(payload) {
  for (const [key, value] of Object.entries(payload)) {
    if (['conditions', 'config', 'quiet_hours', 'output_contract', 'stop_conditions'].includes(key) && typeof value === 'string') {
      payload[key] = value.trim() ? JSON.parse(value) : {};
    }
  }
  return payload;
}

app.use(basicAuth);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', async (_req, res) => {
  const result = await pool.query('select now() as now');
  res.json({ ok: true, databaseTime: result.rows[0].now });
});

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const [
      emergency,
      rules,
      cadences,
      providers,
      slack,
      errors,
      decisions,
      tests,
      workflows,
    ] = await Promise.all([
      pool.query('select * from asm_emergency_controls order by scope, label_es'),
      pool.query('select * from asm_rules order by priority asc limit 8'),
      pool.query('select * from asm_cadences order by lead_type asc'),
      pool.query('select * from asm_providers order by kind, name'),
      pool.query('select * from asm_slack_routes order by name'),
      pool.query('select * from asm_error_logs order by created_at desc limit 8'),
      pool.query('select * from asm_decision_logs order by created_at desc limit 8'),
      pool.query('select * from asm_test_leads order by created_at desc limit 8'),
      pool.query('select * from asm_workflow_modules order by module_type asc, name asc'),
    ]);

    res.json({
      emergency: emergency.rows,
      rules: rules.rows,
      cadences: cadences.rows,
      providers: providers.rows,
      slack: slack.rows,
      errors: errors.rows,
      decisions: decisions.rows,
      tests: tests.rows,
      workflows: workflows.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/seed-defaults', async (_req, res, next) => {
  try {
    await seedDefaults();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/test-leads', async (_req, res, next) => {
  try {
    const result = await pool.query('select * from asm_test_leads order by created_at desc limit 50');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/test-leads', async (req, res, next) => {
  try {
    const decision = await buildDecision(req.body);
    const result = await pool.query(
      `insert into asm_test_leads
       (first_name, last_name, person_id, phone, email, lead_type, channel, message, budget, status, simulated_decision, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning *`,
      [
        req.body.first_name || null,
        req.body.last_name || null,
        req.body.person_id || null,
        req.body.phone || null,
        req.body.email || null,
        req.body.lead_type || 'unknown',
        req.body.channel || 'sms',
        req.body.message,
        req.body.budget || null,
        decision.action,
        decision,
        req.body.notes || null,
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/sandbox/evaluate', async (req, res, next) => {
  try {
    res.json(await buildDecision(req.body));
  } catch (error) {
    next(error);
  }
});

app.get('/api/:resource', async (req, res, next) => {
  try {
    const config = resources[req.params.resource];
    if (!config) return next();

    const result = await pool.query(`select * from ${config.table} order by ${config.order}`);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/:resource/:id', async (req, res, next) => {
  try {
    const config = resources[req.params.resource];
    if (!config) return res.status(404).json({ error: 'Unknown resource' });

    const payload = normalizeJsonFields(pickPayload(req.body, config.fields));
    const entries = Object.entries(payload);
    if (!entries.length) return res.status(400).json({ error: 'No allowed fields provided' });

    const assignments = entries.map(([field], index) => `${field} = $${index + 1}`).join(', ');
    const values = entries.map(([, value]) => value);
    values.push(req.params.id);

    const result = await pool.query(
      `update ${config.table} set ${assignments} where id = $${values.length} returning *`,
      values
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post('/api/logs/test', async (req, res, next) => {
  try {
    const result = await pool.query(
      `insert into asm_decision_logs (workflow_name, channel, lead_type, inbound_message, decision, action_taken, status, reason)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        'Ana System Manager Test',
        req.body.channel || 'system',
        req.body.lead_type || 'unknown',
        req.body.inbound_message || 'Manual test event',
        req.body.decision || { action: 'test' },
        req.body.action_taken || { saved: true },
        req.body.status || 'success',
        req.body.reason || 'Manual log test from manager',
      ]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message });
});

ensureRuntimeSchema()
  .then(seedDefaults)
  .then(() => {
    app.listen(port, () => {
      console.log(`Ana System Manager running on ${port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
