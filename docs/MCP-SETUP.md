# MCP Server — Setup & Unified Action Tools

## Unified Entity Action Tools (quick reference)

Zeno exposes consolidated MCP tools that follow the *Entity Action* pattern. Each tool accepts an `action` discriminator and a `payload` envelope.

Supported unified tools (examples):

- `gates_action` — actions: `list`, `show`, `generate`, `validate`, `start`, `complete`, `regenerate`, `cancel`, `defer`
- `proposal_action` — actions: `list`, `show`, `create`, `generate`, `validate`, `approve`, `reject`, `start`, `progress`
- `reg_action` — actions: `list`, `show`, `deps`, `transfer`, `search`, `inherit`, `trace`, `update`, `db_sync`, `db_status`, `purge_orphans`, `reset_gate`, `regenerate`

### Call shape

- Request: `{ action: string, payload?: Record<string, unknown>, mockResult?: unknown }`
- Response: `CallToolResult` with `structuredContent` containing an object that usually includes `{ action, result }` or an `error` envelope when `isError: true`.

### Mocking in tests / local runs

Pass `mockResult` with either a JSON string or an object. If the mock matches the per-action output schema the handler will return a sanitized structured result; otherwise a textual fallback is returned.

### Common failure modes

- Missing or invalid `payload` — results in `isError: true` and a validation message
- Unknown `action` — tool returns a standardized error
- Validators failing — returned as a validation error envelope

### Example

Call to list proposals:

```json
{ "action": "list", "payload": {} }
```

Server returns structured `proposals` array if successful, or an error envelope when validation fails.

---
