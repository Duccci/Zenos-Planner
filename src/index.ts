/**
 * @module zenos-planner
 *
 * Public API for Zeno's Planner.
 *
 * Re-exports the function registry infrastructure used by the CLI and MCP
 * layers, and exposes the `VERSION` constant for programmatic version checks.
 *
 * Re-exported from {@link ./integration/function-registry}:
 *   - {@link FunctionRegistry} — registry class for registering and invoking functions
 *   - {@link RegisteredFunction} — descriptor type for a registered function
 *   - {@link FunctionErrorResponse} — error payload structure returned on failure
 *   - {@link FunctionResult} — discriminated union result type (success | error)
 *
 * Re-exported from {@link ./integration/function-implementations}:
 *   - {@link createFunctionRegistry} — factory that builds a fully-populated registry
 *   - {@link getGlobalRegistry} — accessor for the process-wide singleton registry
 */

/**
 * Current package version.
 *
 * Mirrors the `version` field in `package.json`. Updated on every release via
 * the standard npm version workflow (`npm version patch|minor|major`).
 */
export const VERSION = '0.1.0'

// Export function registry for use by CLI, MCP, and other modules
export { FunctionRegistry, type RegisteredFunction, type FunctionErrorResponse, type FunctionResult } from './integration/function-registry.js'
export { createFunctionRegistry, getGlobalRegistry } from './integration/function-implementations.js'

