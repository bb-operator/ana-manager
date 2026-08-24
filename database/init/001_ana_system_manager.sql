CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE asm_channel AS ENUM ('sms', 'email', 'call', 'slack', 'system');
CREATE TYPE asm_provider_kind AS ENUM ('sms', 'email', 'voice', 'crm', 'database', 'ai', 'notification');
CREATE TYPE asm_rule_action AS ENUM ('allow_reply', 'block_reply', 'handoff', 'human_review', 'mark_qualified', 'mark_unqualified', 'stop_cadence', 'add_tag', 'notify_slack');
CREATE TYPE asm_rule_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE asm_log_status AS ENUM ('success', 'warning', 'error', 'skipped');

CREATE TABLE asm_system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_es text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description_en text,
  description_es text,
  is_sensitive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_emergency_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_en text NOT NULL,
  label_es text NOT NULL,
  scope asm_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind asm_provider_kind NOT NULL,
  provider_code text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, provider_code)
);

CREATE TABLE asm_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel asm_channel NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  provider_id uuid REFERENCES asm_providers(id) ON DELETE SET NULL,
  max_auto_replies_per_conversation integer NOT NULL DEFAULT 3,
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_slack_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  lead_types text[] NOT NULL DEFAULT '{}',
  event_types text[] NOT NULL DEFAULT '{}',
  webhook_secret_key text,
  channel_label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_es text NOT NULL,
  channel asm_channel,
  version integer NOT NULL DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  prompt_text text NOT NULL,
  output_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_es text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  severity asm_rule_severity NOT NULL DEFAULT 'medium',
  applies_to_channels asm_channel[] NOT NULL DEFAULT ARRAY['sms', 'email', 'call']::asm_channel[],
  applies_to_lead_types text[] NOT NULL DEFAULT ARRAY['buyer', 'seller', 'renter', 'landlord'],
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions asm_rule_action[] NOT NULL DEFAULT '{}',
  confirmation_required boolean NOT NULL DEFAULT true,
  notes_en text,
  notes_es text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_cadences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_es text NOT NULL,
  lead_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_budget numeric,
  min_budget numeric,
  stop_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_cadence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id uuid NOT NULL REFERENCES asm_cadences(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  channel asm_channel NOT NULL,
  delay_minutes integer NOT NULL DEFAULT 0,
  prompt_key text REFERENCES asm_prompts(key) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  stop_if jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cadence_id, step_number)
);

CREATE TABLE asm_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  before_value jsonb,
  after_value jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by text,
  approved_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

CREATE TABLE asm_decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'n8n',
  workflow_id text,
  workflow_name text,
  execution_id text,
  person_id text,
  airtable_record_id text,
  channel asm_channel NOT NULL,
  lead_type text,
  inbound_message text,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_taken jsonb NOT NULL DEFAULT '{}'::jsonb,
  status asm_log_status NOT NULL DEFAULT 'success',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'n8n',
  component text NOT NULL,
  severity asm_rule_severity NOT NULL DEFAULT 'medium',
  workflow_id text,
  execution_id text,
  person_id text,
  message text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_eval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id text,
  channel asm_channel,
  lead_type text,
  scenario text NOT NULL,
  conversation_excerpt text,
  expected_decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_decision jsonb,
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asm_test_leads (
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
);

CREATE TABLE asm_workflow_modules (
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
);

CREATE OR REPLACE FUNCTION asm_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asm_system_settings_updated_at BEFORE UPDATE ON asm_system_settings FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_providers_updated_at BEFORE UPDATE ON asm_providers FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_channels_updated_at BEFORE UPDATE ON asm_channels FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_slack_routes_updated_at BEFORE UPDATE ON asm_slack_routes FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_prompts_updated_at BEFORE UPDATE ON asm_prompts FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_rules_updated_at BEFORE UPDATE ON asm_rules FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_cadences_updated_at BEFORE UPDATE ON asm_cadences FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_cadence_steps_updated_at BEFORE UPDATE ON asm_cadence_steps FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_eval_cases_updated_at BEFORE UPDATE ON asm_eval_cases FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_test_leads_updated_at BEFORE UPDATE ON asm_test_leads FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();
CREATE TRIGGER trg_asm_workflow_modules_updated_at BEFORE UPDATE ON asm_workflow_modules FOR EACH ROW EXECUTE FUNCTION asm_touch_updated_at();

INSERT INTO asm_system_settings (key, label_en, label_es, value, description_en, description_es) VALUES
('ui_language_default', 'Default UI Language', 'Idioma por defecto', '{"value":"es"}', 'Default manager language.', 'Idioma inicial del panel.'),
('qualified_budget_cap', 'Qualified Budget Cap', 'Presupuesto maximo qualified', '{"buyer_seller_max":2000000}', 'Maximum budget for buyer/seller qualified routing.', 'Presupuesto maximo para enrutar buyer/seller como qualified.'),
('one_slack_per_last_in_sid', 'One Slack per Last In SID', 'Un Slack por Last In SID', '{"enabled":true}', 'Prevent duplicate Slack alerts for the same inbound message.', 'Evita duplicados de Slack para el mismo mensaje entrante.');

INSERT INTO asm_emergency_controls (key, label_en, label_es, scope, enabled) VALUES
('all_systems', 'All Ana Automation', 'Toda la automatizacion Ana', 'system', true),
('cadences', 'Cadences', 'Cadencias', 'system', true),
('sms_channel', 'SMS Channel', 'Canal SMS', 'sms', true),
('email_channel', 'Email Channel', 'Canal Email', 'email', true),
('call_channel', 'Call Channel', 'Canal llamadas', 'call', true);

INSERT INTO asm_providers (name, kind, provider_code, enabled, is_primary, config, notes) VALUES
('Twilio SMS', 'sms', 'twilio', true, true, '{"credential_source":"n8n"}', 'Current SMS provider.'),
('Gmail Email', 'email', 'gmail', true, true, '{"credential_source":"n8n"}', 'Current email provider.'),
('Retell Voice', 'voice', 'retell', true, true, '{"credential_source":"n8n"}', 'Current voice AI provider.'),
('Follow Up Boss', 'crm', 'follow_up_boss', true, true, '{"credential_source":"n8n"}', 'Primary CRM.'),
('Airtable', 'database', 'airtable', true, false, '{"credential_source":"n8n"}', 'Operational review table.'),
('OpenAI', 'ai', 'openai', true, true, '{"credential_source":"n8n"}', 'Current LLM provider.');

INSERT INTO asm_channels (channel, enabled, max_auto_replies_per_conversation) VALUES
('sms', true, 3),
('email', true, 3),
('call', true, 1);

INSERT INTO asm_slack_routes (name, enabled, lead_types, event_types, webhook_secret_key, channel_label, notes) VALUES
('buyer_seller_qualified', true, ARRAY['buyer','seller'], ARRAY['qualified','handoff'], 'SLACK_BUYER_SELLER_WEBHOOK', 'Buyer/Seller Channel', 'High-value buyer/seller qualified alerts.'),
('general_qualified', true, ARRAY['renter','landlord','unknown'], ARRAY['qualified','handoff'], 'SLACK_GENERAL_WEBHOOK', 'General Channel', 'Default qualified alerts.'),
('errors', true, ARRAY['buyer','seller','renter','landlord','unknown'], ARRAY['error','human_review'], 'SLACK_ERRORS_WEBHOOK', 'System Errors', 'Operational errors and review alerts.');

INSERT INTO asm_prompts (key, name_en, name_es, channel, prompt_text, output_contract) VALUES
('sms_inbound_decision', 'SMS Inbound Decision', 'Decision SMS entrante', 'sms', 'Classify the inbound SMS and return only JSON. Never promise listings unless listing_search_available is true.', '{"format":"json","required":["action","should_reply","qualified","stop_ai","reason"]}'),
('email_inbound_decision', 'Email Inbound Decision', 'Decision email entrante', 'email', 'Classify the inbound email and return only JSON. Escalate agent requests and frustration.', '{"format":"json","required":["action","should_reply","qualified","stop_ai","reason"]}'),
('call_result_decision', 'Call Result Decision', 'Decision resultado llamada', 'call', 'Classify the call result and return only JSON for qualification, tags, Slack, and next steps.', '{"format":"json","required":["action","qualified","stop_ai","reason"]}'),
('first_touch_sms', 'First Touch SMS', 'Primer toque SMS', 'sms', 'Write the first SMS touch for the lead type. Keep it short, honest, and never offer listings unless available.', '{"format":"text"}'),
('first_touch_email', 'First Touch Email', 'Primer toque email', 'email', 'Write the first email touch for the lead type. Keep it clear, human, and compliant.', '{"format":"text"}');

INSERT INTO asm_rules (key, name_en, name_es, priority, severity, conditions, actions, notes_en, notes_es) VALUES
('agent_request_handoff', 'Agent request means immediate handoff', 'Solicitud de agente significa handoff inmediato', 10, 'critical', '{"phrases":["call me","agent","asap","showing","appointment","today","tomorrow"]}', ARRAY['handoff','mark_qualified','notify_slack','stop_cadence'], 'Do not keep asking budget after an agent request.', 'No seguir pidiendo presupuesto despues de solicitud de agente.'),
('frustration_human_review', 'Frustration stops Ana', 'Frustracion detiene a Ana', 20, 'critical', '{"signals":["idiot","stop asking","another agent","angry","upset"]}', ARRAY['human_review','block_reply','stop_cadence','notify_slack'], 'Hostile/frustrated leads go to human review.', 'Leads molestos pasan a revision humana.'),
('no_listing_promise', 'Ana cannot promise listings', 'Ana no puede prometer listings', 30, 'high', '{"listing_search_available":false}', ARRAY['block_reply'], 'Block any reply promising listings/options when no listing integration exists.', 'Bloquear promesas de listings/opciones si no existe integracion.'),
('stop_after_handoff', 'Stop AI after handoff', 'Detener IA despues del handoff', 40, 'critical', '{"lead_state":["qualified","handed_off"]}', ARRAY['block_reply','stop_cadence'], 'Avoid duplicate or post-handoff AI replies.', 'Evitar respuestas duplicadas o posteriores al handoff.'),
('respect_no_call', 'Respect no-call preference', 'Respetar preferencia sin llamada', 50, 'high', '{"phrases":["no call","dont call","do not call","text only","email only"]}', ARRAY['block_reply'], 'Do not ask for a call after no-call preference.', 'No pedir llamada si el lead dijo que no quiere llamada.');

INSERT INTO asm_cadences (key, name_en, name_es, lead_type, enabled, max_budget, min_budget, stop_conditions) VALUES
('buyer_default', 'Buyer Default Cadence', 'Cadencia buyer default', 'buyer', true, 2000000, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
('seller_default', 'Seller Default Cadence', 'Cadencia seller default', 'seller', true, 2000000, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
('renter_default', 'Renter Default Cadence', 'Cadencia renter default', 'renter', true, null, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}'),
('landlord_default', 'Landlord Default Cadence', 'Cadencia landlord default', 'landlord', true, null, null, '{"stop_if":["replied","qualified","handed_off","human_review","stopped"]}');

INSERT INTO asm_cadence_steps (cadence_id, step_number, channel, delay_minutes, prompt_key, stop_if)
SELECT id, 1, 'sms', 0, 'first_touch_sms', '{"replied":true,"qualified":true}'::jsonb FROM asm_cadences
UNION ALL
SELECT id, 2, 'email', 60, 'first_touch_email', '{"replied":true,"qualified":true}'::jsonb FROM asm_cadences
UNION ALL
SELECT id, 3, 'call', 1440, 'call_result_decision', '{"replied":true,"qualified":true,"no_call":true}'::jsonb FROM asm_cadences;
