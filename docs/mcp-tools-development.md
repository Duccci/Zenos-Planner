# MCP Tools — Entity Action Pattern (Developer Guide)

## Overview

This guide explains the **Entity Action** pattern used by MCP tools (e.g. `req_action`, `proposal_action`, `gates_action`, `archive_action`). The pattern centralizes action dispatch, per-action validation, and standardized output envelopes.

## Key components

- `createEntityActionHandler(config, registry)` — generic handler factory
- `EntityActionConfig` — configuration object describing entity, actions, schemas and handlers
- `inputSchema` / `outputSchema` — Zod schemas for input envelope and final envelope
- `actionOutputSchema(action)` — per-action output schema used for mock and output validation
- `actionHandlers[action]` — function that executes the actual work (returns FunctionResult)
- `validators[action]` — optional array of validator factories (compose with `runValidators`)

## Creating a new entity-action tool (step-by-step)

1. Define Zod schemas
   - Input: `{ action: z.enum([...]), payload: z.any().optional() }`
   - Output: `{ action: z.string(), result: <per-action-result-schema> }`
   - Per-action output: used by `actionOutputSchema(action)` for `mockResult` and output validation

2. Implement action handlers
   - Each handler must return a `FunctionResult` (success: true|false)
   - Keep handlers small and single-responsibility — perform validation via validators where sensible

3. Wire the handler using `createEntityActionHandler`
   - Pass `actionHandlers` and optional `validators`
   - Provide `registry` at runtime (server / integration tests)

4. Add tests
   - Unit tests for `createEntityActionHandler` covering:
     - happy path, handler errors, validator failures, unknown action, mockResult handling
   - Integration tests using `createFunctionRegistry()` + `createToolHandler()` to exercise the tool end-to-end

5. Document the tool in `docs/` and add schema entries in `schemas/` as needed

## Validators

- Validators are factories that return functions returning `ValidationResult`.
- `runValidators` aggregates errors/warnings; a non-allowed result short-circuits and is returned to the caller as a validation error envelope.
- Throwing validators are treated as warnings (do not fail the request).

## Testing recommendations

- Unit tests should mock `actionHandlers` and `registry` to isolate the generic handler logic.
- Use `mockResult` in tests to exercise `handleMockResult` paths (both validated and fallback).
- Integration tests should use `createFunctionRegistry()` to exercise end-to-end parameter validation and error envelopes.

## Example (minimal)

```ts
const handler = createEntityActionHandler({
  entity: 'proposal',
  actions: ['list','show','create'] as const,
  inputSchema: z.object({ action: z.enum(['list','show','create']), payload: z.any().optional() }),
  outputSchema: z.object({ action: z.string(), result: z.any() }),
  actionOutputSchema: (a) => z.object({ /* per-action result */ }),
  actionHandlers: { /* implementations */ },
})
```

## Troubleshooting

- Validation errors: confirm input and output schemas match runtime shapes.
- `mockResult` not parsed: ensure the mock matches `actionOutputSchema(action)` or pass a stringified JSON mock.
- Unknown action: add the new action to `actions` and `actionHandlers`.

## Migration notes

- Existing discrete tools can be migrated to the entity-action pattern by consolidating per-entity handlers and adapting schemas.

---
