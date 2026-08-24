# Ana System Manager Architecture

## Goal

Create one operational manager for Ana's automation system so future changes do not require editing multiple n8n workflows.

## Non-Goals

- Do not replace Follow Up Boss as the CRM.
- Do not create a human chat inbox in the MVP.
- Do not rebuild all n8n flows immediately.
- Do not store provider API keys in plain database rows.

## Runtime Flow

```text
Inbound SMS / Email / Call
        |
        v
n8n receives event
        |
        v
n8n reads Ana System Manager config
        |
        v
n8n applies rules / prompts / emergency controls
        |
        v
n8n executes provider actions
        |
        v
Ana System Manager receives logs
```

## Core Rule

The system manager is the source of truth for configuration. n8n should not hardcode business rules once a rule exists in the manager.

## First n8n Integration Points

- SMS inbound responder and qualifier.
- Email inbound responder and qualifier.
- Call result handler.
- Cadence runner.
- FUB ingestion.

## MVP Tables

- `asm_system_settings`
- `asm_emergency_controls`
- `asm_providers`
- `asm_channels`
- `asm_slack_routes`
- `asm_prompts`
- `asm_rules`
- `asm_cadences`
- `asm_cadence_steps`
- `asm_change_requests`
- `asm_decision_logs`
- `asm_error_logs`
- `asm_eval_cases`

