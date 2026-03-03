# Suggested Commands

## Build

```powershell
npm run build          # Compile TypeScript to dist/
npm run dev            # Watch mode compilation
npm run clean          # Remove dist/
```

## CLI Usage (after build)

```powershell
node bin/zeno.js <command>   # Run CLI directly
# Or if installed globally: zeno <command>
```

## MCP Server

```powershell
npm run mcp-server           # Run MCP server via ts-node
node bin/mcp-server.js       # Run compiled MCP server
```

## Testing

```powershell
npm test                     # Run all tests (vitest run)
npm run test:watch           # Watch mode
npm run test:coverage        # With v8 coverage report (90% threshold)
npm run test:ui              # Vitest UI
```

## Linting & Formatting

```powershell
npm run lint                 # ESLint src/
npm run lint:fix             # ESLint with auto-fix
npm run format               # Prettier write src/**/*.ts
npm run typecheck            # tsc --noEmit (type check only)
```

## Git Utilities (Windows PowerShell)

```powershell
git status
git log --oneline -10
git diff
Get-ChildItem -Recurse      # like ls -la
Select-String -Path "src/**/*.ts" -Pattern "pattern"  # like grep
```

## Zeno Project Management Commands

Zeno-specific commands must be invoked via MCP server tools, not the CLI.

| Task | MCP Tool |
|------|----------|
| Init project | `gates_action` |
| List/show gates | `gates_action` |
| Start/complete gate | `gates_action` |
| List/show requirements | `req_action` |
| List/show/start proposals | `proposal_action` |
| Resolve hash | `mcp_zeno-planner_show_entity` |
| Archive gate | `archive_action` |
| Code metrics | `mcp_zeno-planner_metrics` |

> **Do not use `node bin/zeno.js` for project management.** The MCP tools provide schema-validated structured output and are the authoritative interface.
