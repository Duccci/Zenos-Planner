# Proposal: Template CLI Commands

**Hash**: #s20260131templates  
**Gate**: solitary  
**Requirement**: n/a  
**Status**: completed  
**Created**: 2026-01-31  
**Implemented**: 2026-01-31  
**Archived**: 2026-01-31

## Summary

Implement CLI commands that expose all Zeno templates to users and LLMs. Three commands provide access to templates in different ways: list all templates with metadata, retrieve specific template content, and get template content in a format suitable for LLM context injection.

## Context

Building on the template loader infrastructure, CLI commands enable structured access to templates. This enables:
- LLMs to programmatically request template context via CLI
- Users to discover available templates
- Integration with LLM prompts that need template examples
- Documentation generation tools to access template content

Three complementary commands:
1. `zeno template list` - Display all templates with descriptions
2. `zeno template get <name>` - Retrieve specific template content
3. `zeno template context <name>` - Get template formatted for LLM context (with metadata)

**Dependencies**: Requires template loader infrastructure from proposal #s20260131loader

## Tasks

### Task 1: Implement `zeno template list` Command
**File(s)**: `src/cli/commands/template.ts`  
**Action**: create  

Create template CLI command module with `registerTemplateCommand()` export that registers:

**Command**: `zeno template list [--format <format>]`
- **Description**: List all available templates with descriptions
- **Options**:
  - `--format <format>` (optional): Output format - `table` (default), `json`, `list`
- **Output**:
  - **table**: Formatted ASCII table with columns: Name | Category | Description
  - **json**: JSON array of template objects with name, category, description, path
  - **list**: Simple newline-delimited template names
- **Exit Code**: 0 on success, 1 on error

**Implementation**:
- Use `getTemplateList()` from template-list utility
- Use `formatTemplateList(format)` to render output
- Default to table format if not specified
- Handle invalid format gracefully with error message

**Acceptance Criteria**:
- [ ] `zeno template list` displays all 16 templates
- [ ] Table format is human-readable with proper alignment
- [ ] JSON format is valid and parseable
- [ ] List format shows one template per line
- [ ] `--format table|json|list` options work correctly
- [ ] Invalid format shows error message

### Task 2: Implement `zeno template get <name>` Command
**File(s)**: `src/cli/commands/template.ts` (extend)  
**Action**: modify  

Extend template.ts with second command registration:

**Command**: `zeno template get <name> [--raw]`
- **Arguments**:
  - `<name>` (required): Template name or shorthand (e.g., `gate-prd` or `gate-prd-template`)
- **Options**:
  - `--raw` (optional): Output raw markdown without any formatting or headers
- **Output**: Full template content
- **Exit Code**: 0 on success, 1 on template not found

**Implementation**:
- Accept template name with or without `-template` suffix for convenience
- Use `loadTemplate(name)` from template registry
- By default, output with header: `# Template: [name]` + separator line + content
- With `--raw` flag, output only the template content
- Handle template not found with helpful error message listing available templates

**Acceptance Criteria**:
- [ ] `zeno template get gate-prd-template` loads correct template
- [ ] `zeno template get gate-prd` (without suffix) also works
- [ ] `--raw` flag outputs only template content
- [ ] Default output includes readable header
- [ ] Non-existent template shows error with suggestions
- [ ] Large templates display properly without truncation

### Task 3: Implement `zeno template context <name>` Command
**File(s)**: `src/cli/commands/template.ts` (extend)  
**Action**: modify  

Extend template.ts with third command registration:

**Command**: `zeno template context <name> [--metadata] [--compact]`
- **Arguments**:
  - `<name>` (required): Template name
- **Options**:
  - `--metadata` (optional): Include template metadata in output
  - `--compact` (optional): Minimize whitespace for context injection
- **Output**: Template formatted for LLM context consumption
- **Exit Code**: 0 on success, 1 on template not found

**Implementation**:
- Load template using `loadTemplate(name)`
- Format output for LLM consumption:
  - Default: Include filename, category, word count, then content
  - `--metadata`: Add template purpose, description, usage notes (from metadata)
  - `--compact`: Remove extra whitespace, condense to minimal output
- Output structure:
  ```
  # Template Context
  **Name**: [name]
  **Category**: [category]
  **Word Count**: [count]
  **Purpose**: [description]
  
  [template content]
  ```

**Acceptance Criteria**:
- [ ] `zeno template context gate-prd-template` outputs metadata and content
- [ ] `--metadata` flag includes additional usage information
- [ ] `--compact` flag reduces output size by 20-30%
- [ ] Output is suitable for inclusion in LLM prompts
- [ ] Word count is accurate
- [ ] All template categories work

### Task 4: Add Template Command Tests
**File(s)**: `tests/cli/commands/template.test.ts`  
**Action**: create  

Create comprehensive tests for template commands:
- Test `zeno template list` with all format options
- Test `zeno template get` with each template
- Test template name with/without suffix
- Test `--raw` flag behavior
- Test `zeno template context` command
- Test `--metadata` and `--compact` flags
- Test error handling for non-existent templates
- Test output formats are valid (JSON parseable, markdown readable)

**Acceptance Criteria**:
- [ ] All three commands pass functional tests
- [ ] Format options (table, json, list) produce correct output
- [ ] Template name resolution works with and without suffix
- [ ] Error handling displays helpful messages
- [ ] Tests achieve 100% coverage of template.ts command handlers

---

## Completion Summary

**Tasks Completed**: 4/4
- [x] Task 1: Implement `zeno template list` command
- [x] Task 2: Implement `zeno template get` command  
- [x] Task 3: Implement `zeno template context` command
- [x] Task 4: Add comprehensive tests

**Files Modified**: 2
- `src/cli/commands/template.ts` - Complete CLI command implementation (220 lines)
- `tests/cli/commands/template.test.ts` - Test suite (185 lines)

**Test Coverage**: 11/11 passing (100%)
- All three commands tested with all option combinations
- Error handling validation (non-existent templates, invalid formats)
- Output format validation (table, json, list, raw, compact)
- Template name resolution (full names and short names)

**Commits**: 
- `bc77841`: feat(cli): Template CLI Commands - list, get, context
- `030ca40`: chore(solitary): Archive Template CLI Commands proposal

### Artifacts Created
- `src/cli/commands/template.ts` - CLI command implementations for template access (list, get, context)
- `tests/cli/commands/template.test.ts` - Comprehensive test coverage for all commands

### Quality Metrics
- TypeScript strict mode: ✓ Passing
- Test coverage: 11/11 passing (100%)
- Lint errors: 0
- Type errors: 0
- Build: ✓ Successful

---

## Files Affected

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/commands/template.ts` | create | CLI command implementations for template access |
| `tests/cli/commands/template.test.ts` | create | Tests for all template commands |

---

## Implementation Notes

**Template Name Resolution**:
- Accept both `gate-prd-template` and `gate-prd` as input
- Strip `-template` suffix if present before lookup
- Provide suggestions if template not found (e.g., "did you mean: gate-prd-template?")

**Command Registration Pattern**:
```typescript
export function registerTemplateCommand(program: Command): void {
  const templateGroup = program.command('template')
    .description('Access Zeno templates for context and documentation')
  
  templateGroup
    .command('list')
    .description('List all available templates')
    .option('--format <format>', 'Output format: table, json, list', 'table')
    .action(async (options) => { ... })
  
  templateGroup
    .command('get <name>')
    .description('Get specific template content')
    .option('--raw', 'Output raw markdown without headers')
    .action(async (name, options) => { ... })
  
  templateGroup
    .command('context <name>')
    .description('Get template formatted for LLM context')
    .option('--metadata', 'Include template metadata')
    .option('--compact', 'Minimize whitespace')
    .action(async (name, options) => { ... })
}
```

**Error Messages**:
- Template not found: `"Template '${name}' not found. Available templates: [list]"`
- Invalid format: `"Invalid format '${format}'. Use: table, json, list"`

---

## Rollback

1. Delete `src/cli/commands/template.ts` and `tests/cli/commands/template.test.ts`
2. Remove import of `registerTemplateCommand` from `src/cli/commands/index.ts`
3. Remove the `registerTemplateCommand(program)` call from `registerCommands()` function
4. Run `npm run build` to verify no build errors

---

## Dependencies

**Requires**: #s20260131loader - Template loader infrastructure must be implemented first
- This proposal depends on `src/generation/template-registry.ts` and `src/utils/template-list.ts` existing
- Imports from template-registry and template-list modules

**No subsequent dependencies**: This is the final proposal in template CLI work; no other proposals depend on it yet.

