---
description: "Refactoring Decisions & Technical Debt Management for #s20260201mcp"
applyTo: "**"
---

# Refactoring Notes: MCP Cleanup Proposal #s20260201mcp

## Phase 1 - Complete Success ✅

**Tasks 1-3 achieved excellent results:**

1. **Domain-Specific Registries** (8 modules, ~765 lines)
   - Replaced monolithic `function-implementations.ts` (948 lines)
   - Created focused modules: gates, proposals, requirements, archive, config, template, workflow, schema
   - Result: Clear separation of concerns, enables parallel development

2. **Function Registry Orchestrator** (70 lines)
   - Centralized coordinator delegating to 8 domain registries
   - Maintains 100% backward compatibility
   - Result: Readable, maintainable, no duplicate imports

3. **Handler Factory** (130 lines)
   - `createSchemaValidatingHandler()` - validates output against Zod schema
   - `createBasicHandler()` - simple text output without validation
   - Result: Ready for selective use on simple handlers

## Phase 2 - Strategic Deferral (Learnings)

### Task 4: Bulk Tool Handler Refactoring - DEFERRED

**What Happened:**
Attempted to refactor all 8 tool handler files using the `createSchemaValidatingHandler` factory pattern. Broke 5+ test files.

**Root Causes:**
Each tool handler has **specialized output extraction logic** that doesn't fit the generic factory:

| Tool | Specialization | Why Factory Didn't Work |
|------|---|---|
| `proposal-tools.ts` | Custom JSON parsing, extracts specific properties | Factory's generic `parseJsonSafe()` lost properties |
| `analysis-tools.ts` | Array handling, fallback to metrics | Factory treated arrays as single values |
| `repository-tools.ts` | Error message formatting, "not implemented" detection | Factory lost error context |
| `config-tools.ts` | Config value extraction (e.g., gets `90` from config object) | Factory couldn't navigate nested config |
| `template-tools.ts` | Template body extraction, context formatting | Factory extracted wrong part of response |
| `gate-tools.ts` | Structured output validation | Factory validation too strict |

**Test Failures:**
- `template_get` expected 'template-body', got empty string
- `config_get` expected 90, got undefined
- `repos_list` unknown command error (factory didn't recognize function call)
- `analyze` array handling broken
- `gates regenerate` spy not called (unrelated pre-existing failure)

### Decision: Maintainability Over Speed

**User Direction**: "Make the complex changes focus on maintainability over rapid delivery"

**Implementation**:
1. Reverted all tool handler refactoring changes → restored original implementations
2. Verified tests back to baseline (709/710 passing)
3. Kept handler factory available for **selective** future use
4. Deferred Task 4 pending deeper analysis of tool-specific patterns

### Why This is the Right Call

**Trade-offs:**
| Approach | Pros | Cons |
|----------|------|------|
| **Force Factory** | Code reduction (928→300 lines) | Breaks tests, maintains incorrect patterns |
| **Revert & Defer** | Stable, working code; safe to continue | Keep code duplication short-term |

**Accepted Technical Debt:**
- 928 lines of handler code (40% duplication in boilerplate)
- Deferred until tool-specific refactoring analysis completed

**Future Approach:**
Instead of one-size-fits-all factory, classify tools:

```
Simple (Fit Factory Pattern):
- config_get ✓ (returns config object directly)
- show_entity ✓ (returns entity object directly)

Complex (Require Specialized Handling):
- proposal_* (custom JSON property extraction)
- analysis_* (array detection & fallback)
- repository_* (error message formatting)
- template_* (body extraction & context)
- gate_* (structured validation)
- requirement_* (list filtering & pagination)
```

Plan: Selective refactoring for simple tools only, document why each complex tool needs custom logic.

## Architecture Lessons Learned

### 1. Factory Pattern Applicability

**Works Well For:**
- Configuration retrieval (pass-through responses)
- Simple entity lookups (direct object returns)
- Thin wrapper handlers (no output transformation needed)

**Struggles With:**
- Handlers performing output transformation
- Conditional logic (arrays vs objects vs scalars)
- Error message rewriting
- Property extraction from nested responses
- Tool-specific formatting requirements

### 2. Handler Customization Scope

Each handler needs to:
1. Invoke registry function with validated input ✓ (factory handles)
2. Extract relevant output from response (tool-specific!)
3. Format for MCP structured content (tool-specific!)
4. Handle tool-specific errors (tool-specific!)

Steps 2-4 are where tools diverge. Generic factory can't know:
- Is this response an array or single object?
- Which property contains the real data?
- How should errors be formatted?
- What fields matter for structuredContent?

### 3. Test-Driven Refactoring

**What Went Wrong:**
- Made changes without running tests until the end
- Bulk refactoring made it hard to isolate which tool broke

**Better Approach:**
- Refactor one tool at a time
- Run tests after each tool
- Identify which specific pattern breaks
- Document lesson before moving to next tool

## Recommendations for Phase 2 Continuation

### Short Term (Next Session)
1. **Document each tool's specialization** (why it can't use factory)
2. **Create tool classification** (simple vs complex)
3. **Write analysis doc** explaining handler patterns
4. **Plan selective refactoring** for simple tools only

### Medium Term (Future Proposal)
1. **Refactor simple handlers** (config, show) using factory
2. **Create specialized pattern library** for complex handlers
3. **Reduce duplication strategically** without losing functionality
4. **Document tool handler architecture** for future contributors

### Long Term (Architectural)
1. Consider handler interface redesign that accommodates tool specialization
2. Explore configuration-driven handler generation (Zod + metadata)
3. Build tool handler testing framework for regression prevention

## Files & Commits

### Phase 1 - Completed
✅ 8 domain registry modules created  
✅ function-implementations.ts refactored (948→70 lines)  
✅ handler-factory.ts created (130 lines)  
✅ Tests passing (709/710)  
✅ Build passing (TypeScript strict mode)  

### Phase 2 Task 4 - Deferred
- Reverted: All tool handler bulk refactoring
- Kept: Handler factory (useful for simpler cases)
- Status: Original implementations restored

### Documenting Decision
- This file: REFACTORING_NOTES.md
- Proposal update: Task 4 marked DEFERRED with reasoning
- Test status: Back to expected baseline

## Quotes That Guided Decisions

> "Focus on maintainability over rapid delivery"  
> — User instruction after test failures

This led us to:
1. Revert changes that broke tests (immediate recovery)
2. Keep working code rather than force-fit patterns
3. Plan selective, analyzed approach instead of bulk refactoring
4. Document lessons for future work

## Related Issues & Future Work

**Tracked in Other Proposals:**
- #m26020402tool - Critical tools & guardrails (can proceed independently)
- #m26020403safe - Error handling & git safety (can proceed independently)

**Phase 3 (Cleanup & UX)** - Not blocked by Phase 2 deferral:
- Task 9-14 can proceed in parallel
- These are UX improvements, not refactoring
- No dependency on tool handler refactoring

## Summary

**Phase 1**: Excellent foundation work ✅  
**Phase 2 Task 4**: Bulk refactoring deferred, selective approach planned ⏳  
**Sustainability**: Chose stable over perfect ✅  
**Next Steps**: Analyze tool patterns before refactoring ✅  

**Current Status**: Ready to proceed with Phase 3 (UX) or Phase 2 Task 5-6 (workflow splitting)

---

**Document Date**: 2026-02-01  
**Proposal**: #s20260201mcp  
**Decision Authority**: User direction + architecture review  
**Status**: Active decision guiding Phase 2 planning
