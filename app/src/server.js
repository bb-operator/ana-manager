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
    fields: ['name', 'n8n_workflow_id', 'module_type', 'enabled', 'role_description', 'migration_status', 'control_surface', 'notes'],
    order: 'module_type ASC, name ASC',
  },
  cadenceSteps: {
    table: 'asm_cadence_steps',
    fields: ['cadence_id', 'step_number', 'channel', 'delay_minutes', 'prompt_key', 'enabled', 'stop_if'],
    order: 'cadence_id ASC, step_number ASC',
  },
  cadenceActions: {
    table: 'asm_cadence_actions',
    fields: ['cadence_id', 'round_number', 'action_order', 'channel', 'delay_minutes', 'prompt_key', 'enabled', 'label_es', 'label_en', 'stop_if'],
    order: 'cadence_id ASC, round_number ASC, action_order ASC',
  },
};

const defaultSeeds = {
  settings: `
    INSERT INTO asm_system_settings (key, label_en, label_es, value, description_en, description_es) VALUES
    ('ui_language_default', 'Default UI Language', 'Idioma por defecto', '{"value":"es"}', 'Default manager language.', 'Idioma inicial del panel.'),
    ('qualified_budget_cap', 'Qualified Budget Cap', 'Presupuesto maximo qualified', '{"buyer_seller_max":2000000}', 'Maximum budget for buyer/seller qualified routing.', 'Presupuesto maximo para enrutar buyer/seller como qualified.'),
    ('one_slack_per_last_in_sid', 'One Slack per Last In SID', 'Un Slack por Last In SID', '{"enabled":true}', 'Prevent duplicate Slack alerts for the same inbound message.', 'Evita duplicados de Slack para el mismo mensaje entrante.'),
    ('ana2_trigger_tag', 'Ana 2.0 Trigger Tag', 'Tag disparador Ana 2.0', '{"value":"Ana 2.0 Test"}', 'Manual CRM tag that will enroll contacts into Ana 2.0 when the sandbox workflow is activated.', 'Tag manual del CRM que inscribira contactos en Ana 2.0 cuando activemos el workflow sandbox.'),
    ('ana2_safety_mode', 'Ana 2.0 Safety Mode', 'Modo seguro Ana 2.0', '{"mode":"sandbox","real_sends_enabled":false,"fub_writes_enabled":false}', 'Keeps Ana 2.0 from sending or writing to real systems until explicitly enabled.', 'Evita envios o escrituras reales hasta que lo activemos explicitamente.'),
    ('renter_min_lease_months', 'Renter Minimum Lease Months', 'Minimo meses renter', '{"value":12}', 'Minimum lease length for normal renter qualification.', 'Minimo de meses para calificar renters normales.')
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
    ('airbnb_short_term_email', 'Airbnb / Short-Term Email', 'Correo Airbnb / corto plazo', 'email', 'Tell the lead we mainly handle traditional real estate and may not be the best fit for short-term or Airbnb-style rentals. Do not promise listings.', '{"format":"text"}'),
    ('round2_sms', 'Round 2 SMS', 'SMS dia 2', 'sms', 'Write a concise second-touch SMS. Do not repeat questions already answered. Do not promise listings.', '{"format":"text"}'),
    ('round2_email', 'Round 2 Email', 'Email dia 2', 'email', 'Write a concise second-touch email. Ask for the single most important missing qualification field.', '{"format":"text"}'),
    ('final_exit_email', 'Final Exit Email', 'Email salida final', 'email', 'Write the final polite exit email. Do not crowd the inbox. Leave the door open without sounding needy.', '{"format":"text"}')
    ON CONFLICT (key) DO NOTHING
  `,
  rules: `
    INSERT INTO asm_rules (key, name_en, name_es, priority, severity, conditions, actions, notes_en, notes_es) VALUES
    ('agent_request_handoff', 'Agent request means immediate handoff', 'Solicitud de agente significa handoff inmediato', 10, 'critical', '{"phrases":["call me","agent","asap","showing","appointment","today","tomorrow","llamame","llamar","agente","cita"]}', ARRAY['handoff','mark_qualified','notify_slack','stop_cadence']::asm_rule_action[], 'Do not keep asking budget after an agent request.', 'No seguir pidiendo presupuesto despues de solicitud de agente.'),
    ('frustration_human_review', 'Frustration stops Ana', 'Frustracion detiene a Ana', 20, 'critical', '{"signals":["idiot","stop asking","another agent","angry","upset","stupid","fuck","mierda","idiota"]}', ARRAY['human_review','block_reply','stop_cadence','notify_slack']::asm_rule_action[], 'Hostile/frustrated leads go to human review.', 'Leads molestos pasan a revision humana.'),
    ('no_listing_promise', 'Ana cannot promise listings', 'Ana no puede prometer listings', 30, 'high', '{"listing_search_available":false}', ARRAY['block_reply']::asm_rule_action[], 'Block any reply promising listings/options when no listing integration exists.', 'Bloquear promesas de listings/opciones si no existe integracion.'),
    ('short_term_airbnb', 'Short-term/Airbnb is not a fit', 'Corto plazo/Airbnb no califica', 35, 'high', '{"phrases":["airbnb","short term","short-term","vacation rental","furnished","1 month","2 months","3 months","4 months","5 months","6 months"]}', ARRAY['mark_unqualified','stop_cadence']::asm_rule_action[], 'Use honest short-term response and stop normal cadence.', 'Usar respuesta honesta de corto plazo y detener cadencia normal.'),
    ('stop_after_handoff', 'Stop AI after handoff', 'Detener IA despues del handoff', 40, 'critical', '{"lead_state":["qualified","handed_off"]}', ARRAY['block_reply','stop_cadence']::asm_rule_action[], 'Avoid duplicate or post-handoff AI replies.', 'Evitar respuestas duplicadas o posteriores al handoff.'),
    ('respect_no_call', 'Respect no-call preference', 'Respetar preferencia sin llamada', 50, 'high', '{"phrases":["no call","dont call","do not call","text only","email only","no quiero llamada"]}', ARRAY['block_reply']::asm_rule_action[], 'Do not ask for a call after no-call preference.', 'No pedir llamada si el lead dijo que no quiere llamada.')
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
    INSERT INTO asm_workflow_modules (key, name, n8n_workflow_id, module_type, enabled, role_description, migration_status, control_surface, notes) VALUES
    ('fub_ingestion', 'FUB Ingestion (General uses)', '7a8zKvuSGdvSdA3j', 'intake', true, 'Polls Follow Up Boss events, filters inquiries, registers leads in queue, applies Ana Auto tag.', 'observed', '{"controls":["lead_type_detection","budget_cap","auto_tag","non_lead_detection"]}', 'Current entry point for new FUB inquiries.'),
    ('dispatcher', 'BBP — Ana Motor de Seguimiento (Dispatcher)', 'tDAyougPHt31wsXM', 'dispatcher', true, 'Runs every 20 minutes, finds due leads, advances rounds, sends closing email on round 3.', 'observed', '{"controls":["schedule","due_formula","round_rules","closing_email"]}', 'Cadence orchestration layer.'),
    ('cadence_runner', 'BBP — Ana Cadence Runner', 'FSdIUZCQ3sB9stpa', 'cadence', true, 'Executes touch attempts by call, SMS and email; applies Ana touched tag after first real touch.', 'observed', '{"controls":["call_hours","sms_allowed","first_touch","ana_touched","recap_email"]}', 'Largest flow; primary target for centralizing cadence config.'),
    ('sms_inbound', 'BBP — Ana Inbound SMS', 'UvMU7F3rm6fpWQEc', 'inbound', true, 'Receives SMS, logs inbound, qualifies with AI, replies, routes handoff/review, Slack alert.', 'observed', '{"controls":["reaction_signal","handoff_stop","qualification","slack_route","dnc"]}', 'Primary SMS conversation flow.'),
    ('email_inbound', 'BBP — Ana Inbound Email', 'cTYOo8wU42xDMPj4', 'inbound', true, 'Receives email, logs inbound, checks DNC, qualifies with AI, replies, routes handoff/review.', 'observed', '{"controls":["qualification","handoff_stop","slack_route","dnc","html_reply"]}', 'Primary email conversation flow.'),
    ('call_result_handler', 'BBP - Call Result Handler', 'WCPsTiP9dWkNXVpG', 'call', true, 'Receives Retell analysis, logs call to FUB, marks called/qualified, applies handoff tag and Slack.', 'observed', '{"controls":["call_success","qualified","slack_route","handoff_tag"]}', 'Primary call result processing flow.'),
    ('ana2_fub_intake', 'ANA 2.0 SANDBOX - FUB Intake', '5XNattAZdKgmum8Z', 'ana2_intake', false, 'Sandbox clone of FUB ingestion for the Ana 2.0 migration path.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"7a8zKvuSGdvSdA3j","activation_policy":"manual_test_tag_only"}', 'Created inactive so production keeps running unchanged.'),
    ('ana2_dispatcher', 'ANA 2.0 SANDBOX - Dispatcher', '89aXkRUsRr94wjVI', 'ana2_dispatcher', false, 'Sandbox clone of the dispatcher/motor workflow.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"tDAyougPHt31wsXM","activation_policy":"manual_test_tag_only"}', 'Created inactive so schedules do not collide with production.'),
    ('ana2_cadence_runner', 'ANA 2.0 SANDBOX - Cadence Runner', 'a15nW1VR7dgbBiOp', 'ana2_cadence', false, 'Sandbox clone of cadence execution for Day 1, Day 2, and final exit testing.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"FSdIUZCQ3sB9stpa","activation_policy":"manual_test_tag_only"}', 'Primary flow to wire to manager cadence actions.'),
    ('ana2_sms_inbound', 'ANA 2.0 SANDBOX - Inbound SMS', 'MPX2qSRk257ZY0aZ', 'ana2_inbound', false, 'Sandbox clone of inbound SMS response and qualification.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"UvMU7F3rm6fpWQEc","activation_policy":"manual_test_tag_only"}', 'Will call manager decision endpoint before replying.'),
    ('ana2_email_inbound', 'ANA 2.0 SANDBOX - Inbound Email', 'BzaGSxBZXN28riwv', 'ana2_inbound', false, 'Sandbox clone of inbound email response and qualification.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"cTYOo8wU42xDMPj4","activation_policy":"manual_test_tag_only"}', 'Will call manager decision endpoint before replying.'),
    ('ana2_call_result_handler', 'ANA 2.0 SANDBOX - Call Result Handler', 'uQH8qqRZGkUnKl2E', 'ana2_call', false, 'Sandbox clone of Retell call result processing.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"WCPsTiP9dWkNXVpG","activation_policy":"manual_test_tag_only"}', 'Will route call qualification through hard guardrails.'),
    ('ana2_conversation_nudge', 'ANA 2.0 SANDBOX - Conversation Nudge', 'YD9U2dQgRHe9qveF', 'ana2_nudge', false, 'Sandbox clone of silence/nudge workflow.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"nM3SNXIqCe1zhzd5","activation_policy":"manual_test_tag_only"}', 'Will block listing promises unless listing integration exists.'),
    ('ana2_brain_generator', 'ANA 2.0 SANDBOX - Brain Generator', '55IkX6bckD0sJqfU', 'ana2_brain', false, 'Sandbox clone of follow-up message generator.', 'sandbox_created', '{"folder":"hSHZ6pWSMIPL3UEk","source_workflow_id":"FQc1zftPQMKbbFkC","activation_policy":"manual_test_tag_only"}', 'Will become the prompt/output contract module controlled by the manager.')
    ON CONFLICT (key) DO NOTHING
  `,
};

async function ensureRuntimeSchema() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_cadence_actions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cadence_id uuid NOT NULL REFERENCES asm_cadences(id) ON DELETE CASCADE,
      round_number integer NOT NULL,
      action_order integer NOT NULL,
      channel asm_channel NOT NULL,
      delay_minutes integer NOT NULL DEFAULT 0,
      prompt_key text REFERENCES asm_prompts(key) ON DELETE SET NULL,
      enabled boolean NOT NULL DEFAULT true,
      label_es text,
      label_en text,
      stop_if jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (cadence_id, round_number, action_order)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_ana2_contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      person_id text,
      source text,
      trigger_tag text,
      mode text NOT NULL DEFAULT 'sandbox',
      status text NOT NULL DEFAULT 'new',
      first_name text,
      last_name text,
      name text,
      phone text,
      email text,
      lead_type text NOT NULL DEFAULT 'unknown',
      budget numeric,
      monthly_rent numeric,
      lease_months integer,
      bedrooms text,
      location_preference text,
      timeframe text,
      fub_url text,
      profile text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (person_id, mode)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_ana2_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid NOT NULL REFERENCES asm_ana2_contacts(id) ON DELETE CASCADE,
      direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
      channel asm_channel NOT NULL,
      body text NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_ana2_decisions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid REFERENCES asm_ana2_contacts(id) ON DELETE SET NULL,
      message_id uuid REFERENCES asm_ana2_messages(id) ON DELETE SET NULL,
      channel asm_channel NOT NULL,
      action text NOT NULL,
      qualified boolean NOT NULL DEFAULT false,
      should_reply boolean NOT NULL DEFAULT false,
      should_sms boolean NOT NULL DEFAULT false,
      should_email boolean NOT NULL DEFAULT false,
      should_call boolean NOT NULL DEFAULT false,
      should_notify_slack boolean NOT NULL DEFAULT false,
      stop_cadence boolean NOT NULL DEFAULT false,
      reason text,
      decision jsonb NOT NULL DEFAULT '{}'::jsonb,
      mode text NOT NULL DEFAULT 'sandbox',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_ana2_outbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid REFERENCES asm_ana2_contacts(id) ON DELETE SET NULL,
      decision_id uuid REFERENCES asm_ana2_decisions(id) ON DELETE SET NULL,
      channel asm_channel NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      subject text,
      body text NOT NULL,
      scheduled_for timestamptz,
      provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS asm_ana2_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id uuid REFERENCES asm_ana2_contacts(id) ON DELETE SET NULL,
      run_type text NOT NULL,
      status text NOT NULL DEFAULT 'queued',
      current_round integer NOT NULL DEFAULT 0,
      summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ana2_messages_contact ON asm_ana2_messages(contact_id, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ana2_outbox_status ON asm_ana2_outbox(status, created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ana2_decisions_contact ON asm_ana2_decisions(contact_id, created_at DESC)');
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
      role_description text NOT NULL,
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
    SELECT id, 2, 'sms', 1440, 'first_touch_sms', '{"replied":true,"qualified":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, step_number) DO UPDATE SET
      channel = EXCLUDED.channel,
      delay_minutes = EXCLUDED.delay_minutes,
      prompt_key = EXCLUDED.prompt_key,
      stop_if = EXCLUDED.stop_if
    WHERE asm_cadence_steps.channel = 'email'::asm_channel
      AND asm_cadence_steps.delay_minutes = 60
      AND asm_cadence_steps.prompt_key = 'first_touch_email'
  `);
  await pool.query(`
    INSERT INTO asm_cadence_steps (cadence_id, step_number, channel, delay_minutes, prompt_key, stop_if)
    SELECT id, 3, 'email', 2880, 'first_touch_email', '{"replied":true,"qualified":true,"human_review":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, step_number) DO UPDATE SET
      channel = EXCLUDED.channel,
      delay_minutes = EXCLUDED.delay_minutes,
      prompt_key = EXCLUDED.prompt_key,
      stop_if = EXCLUDED.stop_if
    WHERE asm_cadence_steps.channel = 'call'::asm_channel
      AND asm_cadence_steps.delay_minutes = 1440
      AND asm_cadence_steps.prompt_key = 'call_result_decision'
  `);
  await pool.query(`
    INSERT INTO asm_cadence_actions (cadence_id, round_number, action_order, channel, delay_minutes, prompt_key, label_es, label_en, stop_if)
    SELECT id, 1, 1, 'email', 0, 'first_touch_email', 'Dia 1 email', 'Day 1 email', '{"replied":true,"qualified":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 1, 2, 'sms', 0, 'first_touch_sms', 'Dia 1 SMS', 'Day 1 SMS', '{"replied":true,"qualified":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 1, 3, 'call', 0, 'call_result_decision', 'Dia 1 llamada', 'Day 1 call', '{"replied":true,"qualified":true,"no_call":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 2, 1, 'email', 1440, 'round2_email', 'Dia 2 email', 'Day 2 email', '{"replied":true,"qualified":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 2, 2, 'sms', 1440, 'round2_sms', 'Dia 2 SMS', 'Day 2 SMS', '{"replied":true,"qualified":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 2, 3, 'call', 1440, 'call_result_decision', 'Dia 2 llamada', 'Day 2 call', '{"replied":true,"qualified":true,"no_call":true,"handed_off":true}'::jsonb FROM asm_cadences
    UNION ALL
    SELECT id, 3, 1, 'email', 2880, 'final_exit_email', 'Dia 3 salida final', 'Day 3 final exit', '{"replied":true,"qualified":true,"handed_off":true}'::jsonb FROM asm_cadences
    ON CONFLICT (cadence_id, round_number, action_order) DO NOTHING
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

function textOf(...values) {
  return values.map((value) => String(value || '')).join(' ').toLowerCase();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function extractLeaseMonths(input) {
  if (input.lease_months) return Number(input.lease_months) || 0;
  const text = textOf(input.message, input.profile, input.summary);
  const match = text.match(/\b(\d{1,2})\s*(month|months|mo|mos|mes|meses)\b/i);
  if (match) return Number(match[1]) || 0;
  if (/january\s+(to|-|through)\s+march/i.test(text)) return 3;
  if (/jan(?:uary)?\s+(to|-|through)\s+mar(?:ch)?/i.test(text)) return 3;
  if (/2\s+or\s+more\s+months/i.test(text)) return 2;
  if (includesAny(text, ['short term', 'short-term', 'seasonal rental', 'vacation rental', 'airbnb'])) return 1;
  return 0;
}

function extractMoney(input) {
  if (input.budget) return Number(input.budget) || 0;
  if (input.monthly_rent) return Number(input.monthly_rent) || 0;
  const text = textOf(input.message, input.profile, input.summary);
  const underMatch = text.match(/under\s*\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (underMatch) return Math.round(Number(underMatch[1]) * 1000);
  const kMatch = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);
  const dollarMatch = text.match(/\$?\s*(\d{3,}(?:,\d{3})*)/);
  if (dollarMatch) return Number(dollarMatch[1].replace(/,/g, '')) || 0;
  return 0;
}

function inferLeadType(input) {
  const explicit = String(input.lead_type || input.leadType || '').toLowerCase();
  const text = textOf(input.message, input.profile, input.summary);
  if (explicit && explicit !== 'unknown') return explicit;
  if (includesAny(text, ['i am a renter', 'rental', 'rent ', 'lease', 'tenant'])) return 'renter';
  if (includesAny(text, ['sell my', 'selling', 'seller', 'valuation'])) return 'seller';
  if (includesAny(text, ['buy', 'buyer', 'purchase', 'condo for sale'])) return 'buyer';
  if (includesAny(text, ['landlord', 'tenant for my', 'rent my property'])) return 'landlord';
  return 'unknown';
}

function hasTimeSignal(input) {
  const text = textOf(input.message, input.profile, input.summary);
  return /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|morning|afternoon|evening|am|pm|available|anytime|asap)\b/i.test(text);
}

function generateAna2Reply(input, decision) {
  const first = String(input.first_name || input.name || 'there').trim().split(/\s+/)[0] || 'there';
  if (decision.action === 'log_only') return '';
  if (decision.action === 'opt_out') return "Understood, we won't contact you again.";
  if (decision.action === 'short_term_unqualified') {
    return `Thanks for the details, ${first}. I'll be honest so I do not waste your time: we mainly support longer-term real estate needs, so a short stay like that may not be the best fit for our team.`;
  }
  if (decision.action === 'human_review') {
    return '';
  }
  if (decision.action === 'budget_review') {
    return '';
  }
  if (decision.action === 'handoff_review') {
    return `I can share your request with our team, ${first}. What purchase budget should we note so the right person can review it?`;
  }
  if (decision.qualified) {
    return `You're all set, ${first}. I'll share your preferred time and details with our team, and someone will do their best to reach you.`;
  }
  if (decision.missing_fields?.includes('budget')) {
    return `Thanks, ${first}. What budget should we keep in mind for this search?`;
  }
  if (decision.missing_fields?.includes('lease_months')) {
    return `Thanks, ${first}. How many months are you planning to rent?`;
  }
  return `Thanks, ${first}. What area, budget, and timing should we keep in mind?`;
}

async function buildAna2Decision(input) {
  const text = textOf(input.message, input.profile, input.summary);
  const leadType = inferLeadType(input);
  const leaseMonths = extractLeaseMonths(input);
  const budget = Number(input.budget || 0) || 0;
  const monthlyRent = Number(input.monthly_rent || 0) || (leadType === 'renter' ? extractMoney(input) : 0);
  const annualBudget = leadType === 'renter' && monthlyRent ? monthlyRent * (leaseMonths || 12) : (budget || extractMoney(input));
  const hasAvailability = input.has_time === true || hasTimeSignal(input);
  const settings = await pool.query("select key, value from asm_system_settings where key in ('qualified_budget_cap','renter_min_lease_months')");
  const settingMap = Object.fromEntries(settings.rows.map((row) => [row.key, row.value]));
  const cap = Number(settingMap.qualified_budget_cap?.buyer_seller_max || 2000000);
  const minLeaseMonths = Number(settingMap.renter_min_lease_months?.value || 12);

  const decision = {
    version: 'ana2.v1',
    mode: input.mode || 'sandbox',
    action: 'continue_qualification',
    qualified: false,
    should_reply: true,
    should_sms: input.channel === 'sms',
    should_email: input.channel === 'email',
    should_call: false,
    should_notify_slack: false,
    stop_cadence: false,
    lead_type: leadType,
    budget: annualBudget,
    monthly_rent: monthlyRent,
    lease_months: leaseMonths,
    missing_fields: [],
    matched_rules: [],
    reason: 'No hard stop matched. Continue qualification.',
  };

  if (/^liked\s+[“"].+[”"]$/i.test(String(input.message || '').trim()) || /^reacted\s+/i.test(String(input.message || '').trim())) {
    return {
      ...decision,
      action: 'log_only',
      should_reply: false,
      should_sms: false,
      should_email: false,
      stop_cadence: false,
      matched_rules: ['reaction_signal_log_only'],
      reason: 'Inbound message is a reaction/like. Log the signal, do not reply.',
    };
  }

  if (/\b(stop|unsubscribe|remove me|do not contact|dont contact|no me contacten)\b/i.test(text)) {
    return {
      ...decision,
      action: 'opt_out',
      should_reply: true,
      stop_cadence: true,
      matched_rules: ['opt_out'],
      reason: 'Lead asked to stop contact.',
    };
  }

  if (includesAny(text, ['idiot', 'stupid', 'fuck', 'stop asking', 'another agent', 'ignorant', 'mierda', 'idiota'])) {
    return {
      ...decision,
      action: 'human_review',
      should_reply: false,
      should_sms: false,
      should_email: false,
      should_notify_slack: true,
      stop_cadence: true,
      matched_rules: ['frustration_human_review'],
      reason: 'Frustration or hostile language detected. Stop Ana and send human review.',
    };
  }

  const shortTerm = leadType === 'renter' && leaseMonths > 0 && leaseMonths < minLeaseMonths;
  if (shortTerm || includesAny(text, ['airbnb', 'short term', 'short-term', 'vacation rental', '2 or more months', 'january to march'])) {
    return {
      ...decision,
      action: 'short_term_unqualified',
      qualified: false,
      should_notify_slack: false,
      stop_cadence: true,
      matched_rules: ['short_term_rental'],
      reason: `Renter appears to need fewer than ${minLeaseMonths} months. Do not qualify or handoff as normal.`,
    };
  }

  if (['buyer', 'seller'].includes(leadType) && annualBudget > cap) {
    return {
      ...decision,
      action: 'budget_review',
      should_reply: false,
      should_sms: false,
      should_email: false,
      should_notify_slack: true,
      stop_cadence: true,
      matched_rules: ['buyer_seller_budget_cap'],
      reason: `Budget ${annualBudget} is above cap ${cap}. Route to review, not normal qualified.`,
    };
  }

  const agentRequest = /\b(call me|agent|showing|appointment|asap|speak|talk|llamame|llamar|agente|cita)\b/i.test(text);
  if (['buyer', 'seller'].includes(leadType) && agentRequest && annualBudget <= 0) {
    return {
      ...decision,
      action: 'handoff_review',
      should_notify_slack: true,
      stop_cadence: true,
      missing_fields: ['budget'],
      matched_rules: ['agent_request_missing_budget'],
      reason: 'Lead wants a human but buyer/seller budget is missing. Notify review, do not mark fully qualified.',
    };
  }

  if (leadType === 'renter' && leaseMonths <= 0) decision.missing_fields.push('lease_months');
  if (['buyer', 'seller'].includes(leadType) && annualBudget <= 0) decision.missing_fields.push('budget');

  const enoughToQualify =
    hasAvailability &&
    ((leadType === 'renter' && leaseMonths >= minLeaseMonths) ||
      (['buyer', 'seller'].includes(leadType) && annualBudget > 0 && annualBudget <= cap) ||
      leadType === 'landlord');

  if (enoughToQualify) {
    return {
      ...decision,
      action: 'qualified_handoff',
      qualified: true,
      should_reply: true,
      should_notify_slack: true,
      stop_cadence: true,
      matched_rules: ['qualified_requirements_met'],
      reason: 'Lead has enough qualification data and a timing/availability signal.',
    };
  }

  return decision;
}

async function saveAna2Decision(input, decision, messageId = null) {
  const result = await pool.query(
    `insert into asm_ana2_decisions
      (contact_id, message_id, channel, action, qualified, should_reply, should_sms, should_email, should_call, should_notify_slack, stop_cadence, reason, decision, mode)
     values ($1,$2,$3::asm_channel,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *`,
    [
      input.contact_id || null,
      messageId,
      input.channel || 'system',
      decision.action,
      decision.qualified,
      decision.should_reply,
      decision.should_sms,
      decision.should_email,
      decision.should_call,
      decision.should_notify_slack,
      decision.stop_cadence,
      decision.reason,
      decision,
      decision.mode || 'sandbox',
    ]
  );
  return normalizeRow(result.rows[0]);
}

async function createAna2Outbox(contactId, decisionId, channel, body) {
  if (!body) return null;
  const result = await pool.query(
    `insert into asm_ana2_outbox (contact_id, decision_id, channel, body, status)
     values ($1,$2,$3::asm_channel,$4,'draft')
     returning *`,
    [contactId || null, decisionId || null, channel || 'system', body]
  );
  return normalizeRow(result.rows[0]);
}

function basicAuth(req, res, next) {
  if (req.path.startsWith('/api/ana2/n8n/')) return next();
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

function securityHeaders(_req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function requireSharedSecret(req, res, next) {
  const expected = process.env.N8N_SHARED_SECRET;
  if (!expected) return res.status(503).json({ error: 'N8N_SHARED_SECRET is not configured' });
  const provided = req.headers['x-ana2-secret'] || req.body?.shared_secret;
  if (provided === expected) return next();
  return res.status(401).json({ error: 'Invalid Ana 2.0 shared secret' });
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
    if (['conditions', 'config', 'quiet_hours', 'output_contract', 'stop_conditions', 'stop_if', 'provider_payload'].includes(key) && typeof value === 'string') {
      payload[key] = value.trim() ? JSON.parse(value) : {};
    }
  }
  return payload;
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

function castForField(field) {
  const casts = {
    actions: '::asm_rule_action[]',
    applies_to_channels: '::asm_channel[]',
    channel: '::asm_channel',
    scope: '::asm_channel',
    kind: '::asm_provider_kind',
    severity: '::asm_rule_severity',
    status: '::asm_log_status',
  };
  return casts[field] || '';
}

function parsePgArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  if (typeof value !== 'string') return [value];
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  return trimmed
    .slice(1, -1)
    .split(',')
    .map((item) => item.replace(/^"|"$/g, '').trim())
    .filter(Boolean);
}

function normalizeRow(row) {
  const next = { ...row };
  for (const field of ['actions', 'applies_to_channels', 'applies_to_lead_types', 'lead_types', 'event_types']) {
    if (field in next) next[field] = parsePgArray(next[field]);
  }
  return next;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

app.use(securityHeaders);
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
      cadenceSteps,
      cadenceActions,
      settings,
      ana2Contacts,
      ana2Outbox,
      ana2Decisions,
    ] = await Promise.all([
      pool.query('select * from asm_emergency_controls order by scope, label_es'),
      pool.query('select * from asm_rules order by priority asc, name_es asc'),
      pool.query('select * from asm_cadences order by lead_type asc'),
      pool.query('select * from asm_providers order by kind, name'),
      pool.query('select * from asm_slack_routes order by name'),
      pool.query('select * from asm_error_logs order by created_at desc limit 8'),
      pool.query('select * from asm_decision_logs order by created_at desc limit 8'),
      pool.query('select * from asm_test_leads order by created_at desc limit 8'),
      pool.query('select * from asm_workflow_modules order by module_type asc, name asc'),
      pool.query('select * from asm_cadence_steps order by cadence_id asc, step_number asc'),
      pool.query('select * from asm_cadence_actions order by cadence_id asc, round_number asc, action_order asc'),
      pool.query('select key, label_es, value, description_es, is_sensitive from asm_system_settings order by key asc'),
      pool.query('select * from asm_ana2_contacts order by created_at desc limit 20'),
      pool.query('select * from asm_ana2_outbox order by created_at desc limit 20'),
      pool.query('select * from asm_ana2_decisions order by created_at desc limit 20'),
    ]);

    res.json({
      emergency: normalizeRows(emergency.rows),
      rules: normalizeRows(rules.rows),
      cadences: normalizeRows(cadences.rows),
      providers: normalizeRows(providers.rows),
      slack: normalizeRows(slack.rows),
      errors: normalizeRows(errors.rows),
      decisions: normalizeRows(decisions.rows),
      tests: normalizeRows(tests.rows),
      workflows: normalizeRows(workflows.rows),
      cadenceSteps: normalizeRows(cadenceSteps.rows),
      cadenceActions: normalizeRows(cadenceActions.rows),
      settings: normalizeRows(settings.rows),
      ana2Contacts: normalizeRows(ana2Contacts.rows),
      ana2Outbox: normalizeRows(ana2Outbox.rows),
      ana2Decisions: normalizeRows(ana2Decisions.rows),
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
    res.json(normalizeRows(result.rows));
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
       values ($1,$2,$3,$4,$5,$6,$7::asm_channel,$8,$9,$10,$11,$12)
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
    res.json(normalizeRow(result.rows[0]));
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

app.get('/api/ana2/overview', async (_req, res, next) => {
  try {
    const [contacts, messages, decisions, outbox, cadenceActions, settings] = await Promise.all([
      pool.query('select * from asm_ana2_contacts order by created_at desc limit 50'),
      pool.query('select * from asm_ana2_messages order by created_at desc limit 80'),
      pool.query('select * from asm_ana2_decisions order by created_at desc limit 80'),
      pool.query('select * from asm_ana2_outbox order by created_at desc limit 50'),
      pool.query('select ca.*, c.lead_type from asm_cadence_actions ca join asm_cadences c on c.id = ca.cadence_id order by c.lead_type, ca.round_number, ca.action_order'),
      pool.query("select key, value from asm_system_settings where key like 'ana2_%' or key in ('qualified_budget_cap','renter_min_lease_months') order by key"),
    ]);
    res.json({
      contacts: normalizeRows(contacts.rows),
      messages: normalizeRows(messages.rows),
      decisions: normalizeRows(decisions.rows),
      outbox: normalizeRows(outbox.rows),
      cadenceActions: normalizeRows(cadenceActions.rows),
      settings: normalizeRows(settings.rows),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ana2/contacts', async (req, res, next) => {
  try {
    const name = req.body.name || [req.body.first_name, req.body.last_name].filter(Boolean).join(' ');
    const result = await pool.query(
      `insert into asm_ana2_contacts
        (person_id, source, trigger_tag, mode, status, first_name, last_name, name, phone, email, lead_type, budget, monthly_rent, lease_months, bedrooms, location_preference, timeframe, fub_url, profile, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       on conflict (person_id, mode) do update set
        source = excluded.source,
        trigger_tag = excluded.trigger_tag,
        status = excluded.status,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        name = excluded.name,
        phone = excluded.phone,
        email = excluded.email,
        lead_type = excluded.lead_type,
        budget = excluded.budget,
        monthly_rent = excluded.monthly_rent,
        lease_months = excluded.lease_months,
        bedrooms = excluded.bedrooms,
        location_preference = excluded.location_preference,
        timeframe = excluded.timeframe,
        fub_url = excluded.fub_url,
        profile = excluded.profile,
        notes = excluded.notes,
        updated_at = now()
       returning *`,
      [
        req.body.person_id || `sandbox-${Date.now()}`,
        req.body.source || 'manual',
        req.body.trigger_tag || 'Ana 2.0 Test',
        req.body.mode || 'sandbox',
        req.body.status || 'new',
        req.body.first_name || null,
        req.body.last_name || null,
        name || null,
        req.body.phone || null,
        req.body.email || null,
        req.body.lead_type || 'unknown',
        req.body.budget || null,
        req.body.monthly_rent || null,
        req.body.lease_months || null,
        req.body.bedrooms || null,
        req.body.location_preference || null,
        req.body.timeframe || null,
        req.body.fub_url || null,
        req.body.profile || null,
        req.body.notes || null,
      ]
    );
    res.json(normalizeRow(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get('/api/ana2/contacts/:id/timeline', async (req, res, next) => {
  try {
    const [contact, messages, decisions, outbox] = await Promise.all([
      pool.query('select * from asm_ana2_contacts where id = $1', [req.params.id]),
      pool.query('select * from asm_ana2_messages where contact_id = $1 order by created_at asc', [req.params.id]),
      pool.query('select * from asm_ana2_decisions where contact_id = $1 order by created_at desc', [req.params.id]),
      pool.query('select * from asm_ana2_outbox where contact_id = $1 order by created_at desc', [req.params.id]),
    ]);
    if (!contact.rows[0]) return res.status(404).json({ error: 'Ana 2.0 contact not found' });
    res.json({
      contact: normalizeRow(contact.rows[0]),
      messages: normalizeRows(messages.rows),
      decisions: normalizeRows(decisions.rows),
      outbox: normalizeRows(outbox.rows),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ana2/contacts/:id/messages', async (req, res, next) => {
  try {
    const contactResult = await pool.query('select * from asm_ana2_contacts where id = $1', [req.params.id]);
    const contact = contactResult.rows[0];
    if (!contact) return res.status(404).json({ error: 'Ana 2.0 contact not found' });

    const messageResult = await pool.query(
      `insert into asm_ana2_messages (contact_id, direction, channel, body, metadata)
       values ($1,'inbound',$2::asm_channel,$3,$4)
       returning *`,
      [contact.id, req.body.channel || contact.channel || 'sms', req.body.body || req.body.message || '', req.body.metadata || {}]
    );
    const message = normalizeRow(messageResult.rows[0]);
    const decision = await buildAna2Decision({
      ...contact,
      contact_id: contact.id,
      channel: message.channel,
      message: message.body,
      mode: contact.mode,
    });
    const savedDecision = await saveAna2Decision({ contact_id: contact.id, channel: message.channel }, decision, message.id);
    const reply = generateAna2Reply({ ...contact, message: message.body }, decision);
    const outbox = await createAna2Outbox(contact.id, savedDecision.id, message.channel, reply);
    await pool.query(
      `update asm_ana2_contacts set status = $1, lead_type = $2, updated_at = now() where id = $3`,
      [decision.stop_cadence ? decision.action : 'in_conversation', decision.lead_type, contact.id]
    );
    res.json({ message, decision: savedDecision, outbox });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ana2/decision/evaluate', async (req, res, next) => {
  try {
    const decision = await buildAna2Decision(req.body);
    const saved = await saveAna2Decision(req.body, decision, req.body.message_id || null);
    const reply = generateAna2Reply(req.body, decision);
    const outbox = await createAna2Outbox(req.body.contact_id || null, saved.id, req.body.channel || 'sms', reply);
    res.json({ decision: saved, outbox });
  } catch (error) {
    next(error);
  }
});

app.post('/api/ana2/n8n/evaluate', requireSharedSecret, async (req, res, next) => {
  try {
    const decision = await buildAna2Decision({ ...req.body, mode: req.body.mode || 'sandbox' });
    const saved = await saveAna2Decision(req.body, decision, req.body.message_id || null);
    const reply = generateAna2Reply(req.body, decision);
    const outbox = await createAna2Outbox(req.body.contact_id || null, saved.id, req.body.channel || 'system', reply);
    res.json({ ok: true, decision: saved.decision, decision_id: saved.id, outbox });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/ana2/outbox/:id', async (req, res, next) => {
  try {
    const allowed = normalizeJsonFields(pickPayload(req.body, ['status', 'subject', 'body', 'scheduled_for', 'provider_payload']));
    if (allowed.scheduled_for === '') allowed.scheduled_for = null;
    const entries = Object.entries(allowed);
    if (!entries.length) return res.status(400).json({ error: 'No allowed fields provided' });
    const assignments = entries.map(([field], index) => `${field} = $${index + 1}`).join(', ');
    const values = entries.map(([, value]) => value);
    values.push(req.params.id);
    const result = await pool.query(
      `update asm_ana2_outbox set ${assignments}, updated_at = now() where id = $${values.length} returning *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Outbox item not found' });
    res.json(normalizeRow(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.get('/api/:resource', async (req, res, next) => {
  try {
    const config = resources[req.params.resource];
    if (!config) return next();

    const result = await pool.query(`select * from ${config.table} order by ${config.order}`);
    res.json(normalizeRows(result.rows));
  } catch (error) {
    next(error);
  }
});

app.post('/api/:resource', async (req, res, next) => {
  try {
    const config = resources[req.params.resource];
    if (!config) return next();

    const defaults = {
      rules: {
        key: `${slugify(req.body.name_es || req.body.name_en || 'custom_rule')}_${Date.now()}`,
        name_en: req.body.name_en || req.body.name_es || 'Custom rule',
        name_es: req.body.name_es || req.body.name_en || 'Regla personalizada',
        enabled: true,
        priority: 90,
        severity: 'medium',
        applies_to_channels: ['sms', 'email', 'call'],
        applies_to_lead_types: ['buyer', 'seller', 'renter', 'landlord'],
        conditions: { phrases: [] },
        actions: ['human_review'],
        confirmation_required: true,
        notes_en: '',
        notes_es: '',
      },
      prompts: {
        key: `${slugify(req.body.name_es || req.body.name_en || 'custom_prompt')}_${Date.now()}`,
        name_en: req.body.name_en || req.body.name_es || 'Custom prompt',
        name_es: req.body.name_es || req.body.name_en || 'Prompt personalizado',
        channel: req.body.channel || 'sms',
        version: 1,
        enabled: true,
        prompt_text: req.body.prompt_text || 'Write the prompt instructions here.',
        output_contract: { format: 'text' },
      },
      slack: {
        name: `${slugify(req.body.channel_label || 'custom_slack_route')}_${Date.now()}`,
        enabled: true,
        lead_types: ['buyer', 'seller'],
        event_types: ['qualified', 'handoff'],
        webhook_secret_key: req.body.webhook_secret_key || 'SLACK_WEBHOOK_SECRET_KEY',
        channel_label: req.body.channel_label || 'New Slack Channel',
        notes: req.body.notes || '',
      },
    };

    const payload = normalizeJsonFields(pickPayload({ ...(defaults[req.params.resource] || {}), ...req.body }, config.fields));
    const entries = Object.entries(payload);
    if (!entries.length) return res.status(400).json({ error: 'No allowed fields provided' });

    const columns = entries.map(([field]) => field).join(', ');
    const placeholders = entries.map(([field], index) => `$${index + 1}${castForField(field)}`).join(', ');
    const values = entries.map(([, value]) => value);
    const result = await pool.query(
      `insert into ${config.table} (${columns}) values (${placeholders}) returning *`,
      values
    );

    res.json(normalizeRow(result.rows[0]));
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

    const assignments = entries.map(([field], index) => `${field} = $${index + 1}${castForField(field)}`).join(', ');
    const values = entries.map(([, value]) => value);
    values.push(req.params.id);

    const result = await pool.query(
      `update ${config.table} set ${assignments} where id = $${values.length} returning *`,
      values
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Record not found' });
    res.json(normalizeRow(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

app.post('/api/logs/test', async (req, res, next) => {
  try {
    const result = await pool.query(
      `insert into asm_decision_logs (workflow_name, channel, lead_type, inbound_message, decision, action_taken, status, reason)
       values ($1, $2::asm_channel, $3, $4, $5, $6, $7::asm_log_status, $8)
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
    res.json(normalizeRow(result.rows[0]));
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
