# Gate 14: Documentation Cleanup

> **POST-MVP** — This gate is a documentation polish pass after MVP is stable.
> Keep scope minimal: README cleanup, CLI reference accuracy, AGENTS.md refinement.

**Status**: deferred  
**Type**: chore  
**Created**: 2026-02-04  
**Sequence**: post-MVP  
**Hash**: #g14docs

<!-- Status lifecycle:
  - pending: Gate generated, project-level requirements attributed to gate
  - in_progress: Gate started via `zeno gates start`, gate-specific requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

Clean up README.md and other documentation to reflect the actual MVP implementation. Ensure CLI command reference matches implemented commands, AGENTS.md accurately describes workflows, and inline code comments are present on public APIs. No example projects, no media, no tutorials, no contribution guidelines—just accurate documentation.

## Objectives

### README Cleanup

- [ ] Update README.md to reflect actual MVP features (remove references to unimplemented features)
- [ ] Ensure quick start section works end-to-end
- [ ] Update installation instructions
- [ ] Verify all code snippets in README are accurate

### CLI & MCP Reference

- [ ] Audit CLI command reference against implemented commands (remove stale, add missing)
- [ ] Audit MCP tool reference against registered tools
- [ ] Ensure command examples are accurate and runnable

### AGENTS.md Refinement

- [ ] Update root AGENTS.md to reflect MVP gate structure
- [ ] Update `zeno/AGENTS.md` to reflect actual workflows and command reference
- [ ] Remove references to deferred features (subagent orchestration, TUI dashboard)

### Inline Code Documentation

- [ ] Add JSDoc comments to public API functions (exported from `src/`)
- [ ] Document MCP tool schemas with descriptions

### Error Message Review

- [ ] Review CLI error messages for clarity
- [ ] Ensure MCP tool errors return actionable context

## Context

### What Was Completed Before This Gate

Gates 05-12 (MVP) established all core Zeno functionality.

### Scope Boundaries

**In Scope**:
- README.md accuracy pass
- CLI/MCP command reference audit
- AGENTS.md updates
- JSDoc on public APIs
- Error message review

**Out of Scope**:
- Example projects
- Video walkthroughs, GIF animations, screenshots
- Tutorials (greenfield, existing codebase)
- Contribution guidelines (CONTRIBUTING.md)
- Glossary, FAQ, troubleshooting guide
- Performance tuning guide
- Blog posts, marketing materials

## Implementation Steps

1. Audit README.md against implemented features
2. Audit CLI commands and MCP tools against code
3. Update AGENTS.md files
4. Add JSDoc to public exports
5. Review error messages

## Gate Completion Criteria

- [ ] README.md accurately describes MVP features
- [ ] CLI command reference matches implemented commands
- [ ] MCP tool reference matches registered tools
- [ ] AGENTS.md files reflect actual workflows
- [ ] JSDoc present on public API functions
- [ ] No references to deferred/unimplemented features in docs
