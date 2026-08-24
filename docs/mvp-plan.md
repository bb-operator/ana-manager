# MVP Plan

## Product Shape

Ana System Manager is a configuration and operations manager for the existing Ana automation system.

It controls SMS, email, call, Slack routing, prompts, providers, cadences, safety rules, emergency stops, logs, and evaluations from one place.

## Day-One Scope

- Control SMS, email, and call.
- Use Postgres on the VPS.
- Support Spanish and English labels in the data model.
- Allow prompt editing from day one.
- Include emergency stop levels:
  - all automation
  - cadences
  - SMS
  - email
  - calls
- Prepare change confirmation through `asm_change_requests`.
- Keep n8n as the execution layer while we migrate logic out of giant workflows.
- Production domain: `control.blackbookproperties.com`.

## MVP Implementation Order

1. Install Directus + Postgres locally or on the VPS.
2. Confirm the Directus admin login works.
3. Verify Ana tables are visible in Directus.
4. Create Directus roles and permissions.
5. Add a read-only API token for n8n.
6. Connect n8n to read emergency controls.
7. Connect n8n to read Slack routes.
8. Connect n8n to read prompts.
9. Connect n8n to write decision logs.
10. Move cadence settings from hardcoded n8n nodes into `asm_cadences` and `asm_cadence_steps`.

## Success Criteria

- A Slack channel change does not require editing n8n nodes.
- Turning off SMS does not require editing n8n nodes.
- Turning off all cadences does not require editing n8n nodes.
- Updating a prompt does not require editing n8n nodes.
- Every SMS, email, and call decision creates a log row.
- n8n workflows become smaller over time instead of larger.
