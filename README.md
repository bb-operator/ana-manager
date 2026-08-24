# Ana System Manager

Self-hosted control panel for Ana AI lead automation.

This is not a chat inbox and not a CRM replacement. It centralizes configuration, rules, prompts, cadence controls, providers, Slack routing, emergency stops, logs, and evaluation cases so n8n stops carrying business logic inside giant visual workflows.

## MVP Stack

- Directus: admin UI and API.
- Postgres: source of truth for system configuration and logs.
- n8n: temporary execution layer for SMS, email, calls, Slack, FUB, Airtable.

## Local Start

```bash
cp .env.example .env
docker compose up -d
```

Open:

```text
http://localhost:8055
```

## What Ana System Manager Controls

- SMS, email, and call channel enablement.
- Emergency stop by all automation, cadence, SMS, email, and calls.
- Slack notification routing by lead type and event type.
- Provider configuration for Twilio, Gmail, Retell, Follow Up Boss, Airtable, OpenAI.
- Prompt text and output contracts.
- Qualification and safety rules.
- Cadence steps by lead type.
- Decision logs and error logs from n8n.
- Evaluation cases for future QA.

## Deployment Target

The MVP will run on the existing VPS behind a subdomain such as:

```text
control.blackbookproperties.com
```

Postgres will live on the VPS for the MVP.

## VPS Start

```bash
cp .env.prod.example .env
docker compose -f docker-compose.prod.yml up -d
```

Then open:

```text
https://control.blackbookproperties.com
```
