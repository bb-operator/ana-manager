# Open Questions

## Product Decisions

1. Final subdomain for the manager.
2. Initial admin email for Directus.
3. Which production secrets stay in n8n credentials vs VPS environment variables.
4. Whether Airtable remains the daily review table or becomes read-only later.
5. Whether logs should be retained forever or pruned after a period.

## Rule Decisions

1. Renter minimum budget.
2. Buyer/seller maximum budget behavior above 2M: block, review, or different Slack route.
3. Whether `agent_request_handoff` should mark qualified even without budget.
4. Whether page views should trigger re-engagement or only internal score.
5. Maximum automatic replies per conversation by channel.

