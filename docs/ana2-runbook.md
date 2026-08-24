# ANA 2.0 Runbook

ANA 2.0 is the parallel control system for Ana. It is designed to let us test, audit, and tune decisions without touching the current production n8n workflows.

## Production Safety

- Current n8n production workflows must not be edited.
- ANA 2.0 starts in `sandbox` mode.
- Real sends are disabled by default through `ana2_safety_mode`.
- Follow Up Boss writes are disabled by default through `ana2_safety_mode`.
- n8n can call ANA 2.0 only through `/api/ana2/n8n/*` endpoints with `N8N_SHARED_SECRET`.

## Real Cadence

The cadence is modeled as rounds, not single linear steps:

- Day 1: email, SMS, call.
- Day 2: email, SMS, call.
- Day 3: final exit email only.

Each action has its own channel, delay, prompt, enabled flag, and stop rules.

## Current Hard Guardrails

- SMS reactions such as `Liked "..."` are logged only and do not trigger a reply.
- Opt-out language stops the cadence.
- Frustration or hostile language stops Ana and routes to human review.
- Short-term rentals, Airbnb, and renter lease terms below the configured minimum stop normal qualification.
- Buyer/seller budgets over the configured cap route to review instead of normal qualified.
- Buyer/seller agent requests without budget route to review and ask for budget instead of marking qualified.
- Qualified handoff requires enough deterministic data plus a timing or availability signal.

## Sandbox Test Flow

1. Open the manager at `https://control.blackbookproperties.com`.
2. Go to `Ana 2.0`.
3. Create or update a sandbox contact.
4. Simulate an inbound SMS, email, or call.
5. Review the decision reason and matched rules.
6. Check `Outbox` to see what Ana would have drafted.

## n8n Sandbox Endpoints

- `POST /api/ana2/n8n/intake`: register or update a sandbox contact from the intake clone.
- `POST /api/ana2/n8n/inbound`: log an inbound message, evaluate guardrails, create an outbox draft, and return a legacy-compatible decision for n8n.
- `POST /api/ana2/n8n/cadence/next`: return the configured Day 1, Day 2, or Day 3 actions for a lead type.
- `POST /api/ana2/n8n/message-draft`: generate a controlled draft for sandbox executor flows.
- `POST /api/ana2/n8n/action-result`: log the result of a provider action back into the Manager.

## Current Sandbox Wiring

- Inbound SMS sandbox calls the Manager after `Build Context`.
- Inbound Email sandbox calls the Manager after `Build Context`.
- Both clones keep provider execution in n8n, but decision logic now comes from the Manager.
- Both clones remain inactive until explicitly activated for sandbox testing.

## Migration Path

1. Keep production n8n workflows active.
2. Duplicate production workflows into an `ANA 2.0 SANDBOX` folder.
3. Wire duplicated workflows to ANA 2.0 endpoints.
4. Trigger only with the configured test CRM tag.
5. Validate with internal/test contacts.
6. Enable real sends only after decisions, outbox, Slack, FUB tags, and logs are reliable.
