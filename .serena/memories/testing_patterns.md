# Testing Patterns & Configuration

## Test Runner: Vitest

Config: `vitest.config.ts`

```yaml
include:    tests/**/*.test.ts
exclude:    node_modules, dist
setupFiles: tests/setup.ts
environment: node
globals:    false  (use explicit imports: import { describe, it, expect } from 'vitest')
```

## Coverage (v8 provider)

```yaml
include: src/**/*.ts
exclude: src/**/*.d.ts, src/**/__tests__/**
thresholds:
  statements: 90%
  branches:   85%
  functions:  90%
  lines:      90%
```

## Directory Layout

Tests mirror `src/` structure under `tests/`:

```text
tests/
  setup.ts                       # Global test setup (runs before all tests)
  index.test.ts                  # Library exports smoke test
  entity-action-handler.test.ts  # Root-level integration test
  analysis/
  cli/
  core/
  fixtures/                      # Shared test fixtures (data, mocks)
  generation/
  integration/
  mcp/
  scaffold/
  storage/
  utils/
  tmp/                           # Temp files created during tests (gitignored)
```

## Commands

```powershell
npm test                  # vitest run (single pass)
npm run test:watch        # vitest --watch
npm run test:coverage     # vitest run --coverage
npm run test:ui           # vitest --ui
```

## Patterns & Conventions

- Test files: `*.test.ts` only (no `.spec.ts`)
- Naming: `test<Unit><Scenario><ExpectedResult>` (e.g. `testCreateGateValidInputReturnsGate`)
- One test file per source file (co-located by directory mirror, not by source file)
- Use `tests/fixtures/` for shared test data stubs
- Temp files go in `tests/tmp/` (cleaned up in afterEach/afterAll)
- No shared mutable state between tests — each test is fully isolated
- Use `vi.mock()` for external dependencies (better-sqlite3, simple-git, fs)
- `tests/setup.ts` handles global before/after hooks (check before adding new global state)
- SQLite tests use in-memory DB (`:memory:`) — never write to `zeno/.zeno/registry.db` in tests

## Coverage Enforcement

CI enforces thresholds via `npm run test:coverage`. Failing below 90% statements/functions/lines
or 85% branches blocks the build. New modules must include tests in the same PR/proposal.
