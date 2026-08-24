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
};

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
    ] = await Promise.all([
      pool.query('select * from asm_emergency_controls order by scope, label_es'),
      pool.query('select * from asm_rules order by priority asc limit 8'),
      pool.query('select * from asm_cadences order by lead_type asc'),
      pool.query('select * from asm_providers order by kind, name'),
      pool.query('select * from asm_slack_routes order by name'),
      pool.query('select * from asm_error_logs order by created_at desc limit 8'),
      pool.query('select * from asm_decision_logs order by created_at desc limit 8'),
    ]);

    res.json({
      emergency: emergency.rows,
      rules: rules.rows,
      cadences: cadences.rows,
      providers: providers.rows,
      slack: slack.rows,
      errors: errors.rows,
      decisions: decisions.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/:resource', async (req, res, next) => {
  try {
    const config = resources[req.params.resource];
    if (!config) return res.status(404).json({ error: 'Unknown resource' });

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

app.listen(port, () => {
  console.log(`Ana System Manager running on ${port}`);
});

