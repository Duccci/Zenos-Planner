# Code Style and Conventions

## TypeScript

- **Strict mode**: All strict flags enabled (`strict: true`, `noImplicitAny`, `strictNullChecks`, etc.)
- **Target**: ES2024, NodeNext module resolution
- **Explicit return types**: Required on all exported functions and module boundaries
  - ESLint rules: `@typescript-eslint/explicit-function-return-type` and `@typescript-eslint/explicit-module-boundary-types` set to `error`
- **No unused vars**: Enforced; prefix with `_` to suppress (e.g. `_unused`)
- **ESM modules**: Use `.js` extension in import paths (even for `.ts` source files, e.g. `import { foo } from './utils/errors.js'`)
- **Type assertions**: Avoid `as any`; prefer narrowing or custom type guards

## Formatting (Prettier)

- No semicolons (`"semi": false`)
- Single quotes (`"singleQuote": true`)
- 2-space indentation
- 100 char print width
- Trailing commas (`"trailingComma": "es5"`)
- LF line endings

## Naming Conventions

- **Files**: kebab-case (e.g. `function-registry.ts`, `error-handler.ts`)
- **Classes/Interfaces/Types**: PascalCase
- **Functions/Methods/Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE for module-level constants
- **Private/internal**: prefix with `_` only if needed for unused var suppression

## Error Handling

- Custom error types in `src/utils/errors.ts` (`isZenoError`, `formatError`)
- Never silently swallow errors
- Use structured errors with context
- Domain-specific error classes extending base Error

## File/Module Structure

- One command per file in `src/cli/commands/`
- Handler-based MCP tools in `src/mcp/tools/` + Zod schemas in `src/mcp/schemas/`
- Prefer handler implementations over function-backed CLI wrappers for MCP tools
- Export everything needed from module entry points

## Documentation

- Module-level JSDoc blocks at top of files (brief description)
- Function JSDoc only where non-obvious
- Keep comments minimal; prefer self-documenting code
