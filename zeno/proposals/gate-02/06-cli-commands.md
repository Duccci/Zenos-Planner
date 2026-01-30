# Proposal: Implement CLI Commands for Project Initialization and Gate Management

**Hash**: #g02p06cli  
**Gate**: gate-02 - Zeno Engine & Gate Generation  
**Requirement**: #p02init  
**Status**: pending  
**Created**: 2026-01-29

---

## Summary

Implements the `zeno init` command with interactive prompts and gate management commands (`zeno gates list`, `zeno gates show`, `zeno gates start`, `zeno gates complete`). The init command guides users through project setup, collects end state description and existing codebase info, and triggers the full initialization workflow. Gate commands enable project roadmap navigation and gate lifecycle management.

---

## Context

### Requirements Context

This proposal implements the Project Initialization requirement (#p02init) by creating the user-facing CLI commands that tie together all the engine, analysis, and generation components. These commands are the primary interface for human interaction with Zeno's planning system.

### Why This Change

Zeno's capabilities are only useful if users can easily access them. Well-designed CLI commands with clear prompts and helpful output make the difference between a powerful tool and an unusable one. `zeno init` needs to guide users through project setup without requiring deep understanding of Zeno concepts.

### Dependencies

| Hash | Type | Description |
|------|------|-------------|
| #g02p04engine | requires | Uses gate generator for gate generation workflow |
| #g02p05templates | requires | Uses template rendering for PRD output || #g02p09writeanalysis | integrates | `zeno gates complete` triggers write-time analysis hook (optional) |
---

## Tasks

### Task 1: Implement zeno init Command

**File(s)**: `src/cli/commands/init.ts`  
**Action**: modify

Extend the init command skeleton to implement full interactive initialization workflow. Prompt for project name, end state description, existing codebase location. Handle validation and error cases gracefully. Trigger code analysis if existing codebase provided.

**Acceptance**:
- [ ] Prompts for project name with validation
- [ ] Prompts for end state description (multi-line input welcome)
- [ ] Asks if project has existing codebase
- [ ] If yes, prompts for codebase path and validates directory exists
- [ ] Runs initialization workflow on valid input
- [ ] Provides clear error messages for invalid input

---

### Task 2: Implement zeno gates list Command

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Implement the `gates list` subcommand that displays all project gates with status, sequence number, and brief description. Format output as table for easy scanning. Show gate dependencies if requested.

**Acceptance**:
- [ ] Displays all gates in project
- [ ] Shows gate sequence, status, name, objective summary
- [ ] Formats output as readable table
- [ ] Supports `--verbose` flag for additional details
- [ ] Supports `--status <status>` filter (pending, in_progress, completed)

---

### Task 3: Implement zeno gates show Command

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Implement the `gates show <gate-id>` subcommand that displays detailed gate information including objectives, requirements, implementation steps, and dependencies. Reference gate PRD file for full content.

**Acceptance**:
- [ ] Accepts gate ID (e.g., `gate-02`) or gate name
- [ ] Displays gate name, status, sequence
- [ ] Lists gate objectives
- [ ] Shows requirement count and summary
- [ ] References full PRD file location
- [ ] Shows dependent gates (gates that depend on this one)

---

### Task 4: Implement zeno gates start Command

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Implement the `gates start <gate-id>` subcommand that transitions gate from `pending` to `in_progress`. This command triggers gate-specific requirement generation if not already done. Requires human confirmation before starting.

**Acceptance**:
- [ ] Accepts gate ID to start
- [ ] Validates gate status is `pending`
- [ ] Prompts user to confirm starting gate
- [ ] Generates gate-specific requirements if needed
- [ ] Updates gate status in database
- [ ] Prints success message with next steps

---

### Task 5: Implement zeno gates complete Command

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Implement the `gates complete <gate-id>` subcommand that transitions gate from `in_progress` to `completed`. Creates a git tag and saves completed gate reference. Integrates with write-time analysis hook for greenfield projects. Requires human confirmation.

**Acceptance**:
- [ ] Accepts gate ID to complete
- [ ] Validates gate status is `in_progress`
- [ ] Runs automated checks (tests, coverage, linting)
- [ ] Prompts user to confirm completion
- [ ] Creates git tag for gate completion
- [ ] Updates gate status in database
- [ ] **NEW**: After completion, prompts: "Analyze code changes for this gate? (y/n)" (optional, via #g02p09writeanalysis)
- [ ] **NEW**: If yes, invokes write-time analyzer and displays results summary
- [ ] Prints completion summary

---

### Task 6: Integrate @inquirer/prompts for Interactive Input

**File(s)**: `src/cli/commands/init.ts`, `src/cli/commands/gates.ts`  
**Action**: modify

Use @inquirer/prompts for user-friendly interactive prompts. Support text input, multi-line input, single-select, confirm dialogs. Provide helpful validation messages and examples.

**Acceptance**:
- [ ] Uses @inquirer/prompts for all user input
- [ ] Supports multi-line input for end state description
- [ ] Provides input validation with error messages
- [ ] Shows examples where helpful
- [ ] Supports default values where appropriate

---

### Task 7: Add Status Checking and Validation

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Implement status transition validation - gates can only transition through valid states. Add checks to prevent invalid state transitions (e.g., can't complete a pending gate).

**Acceptance**:
- [ ] Validates gate status before transitions
- [ ] Prevents invalid state transitions
- [ ] Provides clear error messages for invalid operations
- [ ] Suggests valid next steps for gates

---

### Task 8: Write Unit Tests for CLI Commands

**File(s)**: `tests/cli/commands/init.test.ts`, `tests/cli/commands/gates.test.ts`  
**Action**: create

Write comprehensive tests for init and gates commands. Mock user input, validate output, test error handling and edge cases.

**Acceptance**:
- [ ] Init tests: Project name validation, end state capture, codebase detection
- [ ] Gates tests: List output format, show details, state transitions
- [ ] Error handling tests: Invalid gate IDs, invalid state transitions
- [ ] Coverage meets 90% threshold for CLI modules

---

### Task 9: Integrate zeno gates regenerate Command (from #g02p09writeanalysis)

**File(s)**: `src/cli/commands/gates.ts`  
**Action**: modify

Add new `zeno gates regenerate --from-analysis` command that triggers data-driven gate regeneration based on analyzed code metrics. Implemented by #g02p09writeanalysis proposal; this task ensures CLI integration and user-facing command.

**Acceptance**:
- [ ] New command: `zeno gates regenerate --from-analysis`
- [ ] Validates that completed gates have analysis data
- [ ] Displays comparison: current gate plan vs. data-informed suggestions
- [ ] Requires explicit user confirmation before applying changes
- [ ] Updates gate sequence and dependencies based on metrics
- [ ] Creates audit trail of regeneration decision

---

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/cli/commands/init.ts` | modify | Interactive init workflow with prompts |
| `src/cli/commands/gates.ts` | modify | Implement list, show, start, complete subcommands |
| `tests/cli/commands/init.test.ts` | create | Init command tests |
| `tests/cli/commands/gates.test.ts` | create | Gates command tests |

---

## Implementation Notes

- Use Commander.js subcommands structure for `gates list|show|start|complete`
- @inquirer/prompts provides better UX than readline-based input
- Gate ID can be either `gate-XX` format or full gate name; normalize internally
- Status validation should prevent state transitions (pending → completed is invalid)
- Confirmation prompts for state-changing operations (start, complete) for safety
- Consider showing next steps or suggestions after each command

---

## Rollback

If rejected or failed: Revert modifications to `src/cli/commands/init.ts` and `src/cli/commands/gates.ts`. Delete test files.
