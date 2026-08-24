# n8n Integration Plan

## Phase 1: Read-Only Config

n8n keeps current behavior but reads config from Directus/Postgres.

Checks:

- Is all automation enabled?
- Is the current channel enabled?
- Is cadence enabled?
- Which Slack route applies?
- Which prompt key applies?

## Phase 2: Centralized Safety Rules

n8n checks these before sending any response:

- `stop_after_handoff`
- `frustration_human_review`
- `agent_request_handoff`
- `respect_no_call`
- `no_listing_promise`

## Phase 3: Centralized Cadence

Cadence runner no longer stores delays and prompt choices in nodes. It reads:

- lead type
- step number
- channel
- delay minutes
- stop conditions
- prompt key

## Phase 4: Logs

Every n8n workflow writes one row to:

- `asm_decision_logs` for normal decisions.
- `asm_error_logs` for failures.

Minimum fields:

- workflow id
- workflow name
- execution id
- person id
- channel
- decision
- action taken
- status
- reason

