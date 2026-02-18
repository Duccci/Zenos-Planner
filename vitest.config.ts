import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['tests/setup.ts'],
    // Suppress console output from code-under-test during runs.
    // Tests that need to assert on console output should use vi.spyOn(console, ...).
    onConsoleLog: () => false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/index.ts', // Pure re-exports, tested via exported modules
        'src/cli/index.ts', // CLI framework/Commander.js integration (tested via CLI integration tests)
        'src/mcp/server.ts', // Signal handlers and process lifecycle management (impractical in unit tests)
        'src/analysis/types.ts', // Pure TypeScript interfaces, no runtime code
        'src/core/types.ts', // Pure TypeScript interfaces, no runtime code
        'src/generation/types.ts', // Pure TypeScript interfaces, no runtime code
        'src/generation/diagram-types.ts', // Type definitions and discovery with minimal runtime logic
        'src/mcp/schemas/**', // Zod schema definitions, tested indirectly through handlers
        'src/mcp/tools/index.ts', // Barrel re-export of handlers
        'src/scaffold/index.ts', // Simple wrapper/barrel export
        'src/utils/config.ts', // Configuration loading and schema definitions, integration-level
        'src/utils/logger.ts', // Logger initialization, tested via logger usage
        'src/utils/version.ts', // Version parsing with minimal logic
        'src/utils/errors.ts', // Error class definitions (constructors only)
        'src/storage/migrations.ts', // Database migration application, integration-level
        'src/storage/database-cleanup.ts', // Database cleanup utilities, integration-level
        'src/mcp/dev-mode.ts', // Development mode helper, not production code
        'src/mcp/diagnostics.ts', // Diagnostics output, not business logic
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
})


