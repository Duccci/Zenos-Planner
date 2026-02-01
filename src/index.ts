/**
 * Zeno's Planner - Entry Point
 *
 * This file serves as the main module export for the Zeno's Planner library.
 */

export const VERSION = '0.1.0'

// Export function registry for use by CLI, MCP, and other modules
export { FunctionRegistry, type RegisteredFunction, type FunctionErrorResponse, type FunctionResult } from './integration/function-registry.js'
export { createFunctionRegistry, getGlobalRegistry } from './integration/function-implementations.js'

