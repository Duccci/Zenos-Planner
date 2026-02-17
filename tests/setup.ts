/**
 * Vitest global test setup
 *
 * This file is loaded before each test file runs.
 * Add global test utilities, mocks, or configuration here.
 */

// Extend Vitest's expect if needed
// import { expect } from 'vitest'

// Suppress non-error logging during tests (only show errors)
process.env['ZENO_LOG_LEVEL'] = 'error'

/**
 * Global test timeout (milliseconds)
 */
export const TEST_TIMEOUT = 10000

/**
 * Creates a temporary test context with cleanup
 */
export function createTestContext(): { cleanup: () => void } {
  const cleanupFns: Array<() => void> = []

  return {
    cleanup: (): void => {
      for (const fn of cleanupFns.reverse()) {
        fn()
      }
    },
  }
}


