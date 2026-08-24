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
n8n sends normalized contact + message to Ana System Manager
        |
        v
Ana System Manager applies rules, guardrails, cadence config, and safety switches
        |
        v
Ana System Manager returns an executable decision
        |
        v
n8n executes provider actions only when the decision allows it
        |
        v
Ana System Manager receives logs
```

## Core Rule

The system manager is the source of truth for configuration and business decisions. n8n should become a thin execution layer for provider actions such as Twilio, Gmail, Retell, Slack, Follow Up Boss, and Airtable.

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
