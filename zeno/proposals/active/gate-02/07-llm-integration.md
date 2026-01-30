# Proposal: Implement LLM Integration Layer

**Hash**: #g02p07llm  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02llmint  
**Status**: pending  
**Created**: 2026-01-29

---

## Summary

Implements the LLM integration layer that defines function signatures for Zeno commands and provides invocation helpers for AI agents. This layer doesn't call external APIs; instead, it documents how LLM-based coding assistants (like Cursor with Claude) can invoke Zeno functions during workflow execution. Enables seamless AI-driven implementation without external dependencies.

---

## Context

### Requirements Context

This proposal implements the LLM Integration Layer requirement (#p02llmint) by creating a well-documented interface that AI agents can use to invoke Zeno commands. The layer serves as a bridge between human prompts (given to AI agents) and Zeno functionality, enabling hands-off workflow execution.

### Why This Change

Zeno's power comes from AI-assisted implementation. By documenting how LLMs can invoke Zeno functions, we enable workflows like:
1. Human: "Generate proposals for Gate 2"
2. AI: Calls `zeno proposal generate gate-02` internally
3. AI: Presents results back to human for approval

This requires clear function signatures, example invocations, and documentation on how AI agents should use these commands.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p06cli | requires | Documents CLI commands that LLMs will invoke |
| #g02p04engine | requires | Uses gate generation engine capabilities |

---

## Tasks

### Task 1: Define Function Signature Registry

**File(s)**: `src/integration/function-registry.ts`  
**Action**: create

Create a registry of all Zeno functions that LLMs can invoke. For each function, define: name, description, parameters (with types), return type, and usage examples. This registry serves as the specification for AI agent integration.

**Acceptance**:
- [ ] Exports `FunctionRegistry` with all invokable Zeno functions
- [ ] Each function includes: name, description, parameters, return type
- [ ] Parameters include type, description, and whether required
- [ ] Examples show typical invocation patterns
- [ ] Registry is machine-readable for code generation

---

### Task 2: Implement Function Signature Provider

**File(s)**: `src/integration/llm-layer.ts`  
**Action**: create

Implement the main LLM integration layer that provides function signatures to AI agents. Includes methods to get all available functions, get specific function details, and format for different LLM APIs (OpenAI, Anthropic, etc.).

**Acceptance**:
- [ ] Exports `getFunctionSignatures(): FunctionDefinition[]` function
- [ ] Returns signatures in OpenAI function calling format
- [ ] Supports Anthropic tools format as well
- [ ] Includes comprehensive descriptions for each function
- [ ] Supports function filtering by category (gates, requirements, proposals, etc.)

---

### Task 3: Create LLM Integration Documentation

**File(s)**: `src/integration/LLM_INTEGRATION.md`  
**Action**: create

Create comprehensive documentation for LLMs on how to use Zeno. Include:
- Function signatures and descriptions
- Typical workflow examples
- Success/failure patterns
- Error handling guidance
- Best practices for using Zeno in AI-assisted workflows

**Acceptance**:
- [ ] Documents all available functions with examples
- [ ] Explains gate generation workflow for LLMs
- [ ] Shows requirement decomposition workflow
- [ ] Includes error handling patterns
- [ ] Provides workflow examples (init, gate generation, proposal creation)

---

### Task 4: Implement Command Invocation Helpers

**File(s)**: `src/integration/command-invoker.ts`  
**Action**: create

Create helper utilities that LLMs can use to invoke Zeno commands programmatically. Includes argument validation, error handling, and result formatting.

**Acceptance**:
- [ ] Exports `invokeCommand(command: string, args: string[]): Promise<CommandResult>` function
- [ ] Validates arguments match function signature
- [ ] Provides helpful error messages for invalid arguments
- [ ] Returns structured result with status and output
- [ ] Handles both synchronous and asynchronous operations

---

### Task 5: Document Zeno Functions Available to LLMs

**File(s)**: `src/integration/FUNCTIONS.md`  
**Action**: create

Create a reference document listing all Zeno functions available to LLMs, organized by category. Format should be easy for LLMs to understand and reference.

**Acceptance**:
- [ ] Lists all gates-related functions (list, show, start, complete)
- [ ] Lists all requirement functions (list, show, deps)
- [ ] Lists all proposal functions (list, show, start, validate, approve)
- [ ] Lists all init and config functions
- [ ] Shows example invocations for each function
- [ ] Includes prerequisite relationships (what must happen before what)

---

### Task 6: Implement Workflow Context Provider

**File(s)**: `src/integration/context-provider.ts`  
**Action**: create

Create utilities that help LLMs understand the current project state. Provides context about gates, requirements, proposals, and project configuration. Helps LLMs make informed decisions about next steps.

**Acceptance**:
- [ ] Exports `getProjectContext(): ProjectContext` function
- [ ] Returns current gate status and progress
- [ ] Lists pending proposals and their status
- [ ] Shows project configuration
- [ ] Provides suggestions for next actions based on project state

---

### Task 7: Write Unit Tests for LLM Integration

**File(s)**: `tests/integration/function-registry.test.ts`, `tests/integration/llm-layer.test.ts`, `tests/integration/command-invoker.test.ts`, `tests/integration/context-provider.test.ts`  
**Action**: create

Write comprehensive tests for function registry, invocation helpers, and context providers. Test with sample LLM invocations.

**Acceptance**:
- [ ] Registry tests: Function listing, signature correctness, format validation
- [ ] Layer tests: Signature generation for different LLM APIs
- [ ] Invoker tests: Command execution, argument validation, error handling
- [ ] Context tests: Project state accuracy, workflow suggestions
- [ ] Coverage meets 90% threshold for integration modules

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/integration/function-registry.ts` | create | Zeno function signature registry |
| `src/integration/llm-layer.ts` | create | Main LLM integration layer |
| `src/integration/command-invoker.ts` | create | Command invocation helpers |
| `src/integration/context-provider.ts` | create | Project context provider |
| `src/integration/LLM_INTEGRATION.md` | create | LLM integration documentation |
| `src/integration/FUNCTIONS.md` | create | Function reference for LLMs |
| `tests/integration/function-registry.test.ts` | create | Registry tests |
| `tests/integration/llm-layer.test.ts` | create | LLM layer tests |
| `tests/integration/command-invoker.test.ts` | create | Invoker tests |
| `tests/integration/context-provider.test.ts` | create | Context provider tests |

---

## Implementation Notes

- Function signatures should be compatible with OpenAI's function calling and Anthropic's tools
- Include detailed descriptions that LLMs can understand and reference
- Workflow examples should show happy paths and common error cases
- Context provider helps LLMs understand project state without expensive database queries
- Consider versioning function signatures as new functions are added
- Maintain backward compatibility as Zeno evolves

---

## Rollback

If rejected or failed: Delete created files in `src/integration/` and `tests/integration/`.
