# ANA 2.0 n8n Sandbox Clones

Folder: `ANA 2.0 SANDBOX`

Folder ID: `hSHZ6pWSMIPL3UEk`

All cloned workflows were created inactive on August 24, 2026. Production workflows were not edited.

| Production Workflow | Production ID | ANA 2.0 Clone | Clone ID | Status |
| --- | --- | --- | --- | --- |
| FUB Ingestion (General uses) | `7a8zKvuSGdvSdA3j` | ANA 2.0 SANDBOX - FUB Intake | `5XNattAZdKgmum8Z` | inactive |
| BBP - Ana Motor de Seguimiento (Dispatcher) | `tDAyougPHt31wsXM` | ANA 2.0 SANDBOX - Dispatcher | `89aXkRUsRr94wjVI` | inactive |
| BBP - Ana Cadence Runner | `FSdIUZCQ3sB9stpa` | ANA 2.0 SANDBOX - Cadence Runner | `a15nW1VR7dgbBiOp` | inactive |
| BBP - Ana Inbound SMS (responde + califica) | `UvMU7F3rm6fpWQEc` | ANA 2.0 SANDBOX - Inbound SMS | `MPX2qSRk257ZY0aZ` | inactive |
| BBP - Ana Inbound Email (responde + califica) | `cTYOo8wU42xDMPj4` | ANA 2.0 SANDBOX - Inbound Email | `BzaGSxBZXN28riwv` | inactive |
| BBP - 4. Call Result Handler | `WCPsTiP9dWkNXVpG` | ANA 2.0 SANDBOX - Call Result Handler | `uQH8qqRZGkUnKl2E` | inactive |
| BBP - Ana Conversation Nudge (silencio) | `nM3SNXIqCe1zhzd5` | ANA 2.0 SANDBOX - Conversation Nudge | `YD9U2dQgRHe9qveF` | inactive |
| BBP - Brain (Follow-up Message Generator) | `FQc1zftPQMKbbFkC` | ANA 2.0 SANDBOX - Brain Generator | `55IkX6bckD0sJqfU` | inactive |

## Validation Notes

- All 8 clones validated with no structural errors.
- Retell nodes show as unknown to the MCP validator because Retell is a community node, but they can run on the n8n instance where the package is installed.
- The original cadence runner still shows maintainability warnings because it has 65 nodes and limited explicit error handling. ANA 2.0 moves decision logic and audit trails into the manager to reduce that risk.

## Next Wiring Step

The next safe step is to add a manager decision gate into each clone:

- `POST https://control.blackbookproperties.com/api/ana2/n8n/evaluate`
- Header: `x-ana2-secret`
- Payload: contact, channel, inbound message, lead type, budget, rent, lease months, and current context.

This must be done only on the clone workflows above.
