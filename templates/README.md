# Zeno's Planner Templates

This directory contains all templates used by Zeno's Planner for generating project documentation and architecture diagrams.

## Directory Structure

```
templates/
├── architecture-templates/    # Architecture diagram templates
│   ├── system-overview-template.md
│   ├── gate-lifecycle-template.md
│   ├── data-flow-template.md
│   ├── gate-roadmap-template.md
│   └── README.md
└── md-templates/             # General markdown templates
    ├── agents-template.md
    ├── project-prd-template.md
    └── architecture-diagram-template.md
```

---

## Architecture Templates

**Location**: `architecture-templates/`

Specialized templates for each type of architecture diagram:

### System Overview Template
- **File**: `system-overview-template.md`
- **Purpose**: Component architecture with layered structure
- **Output**: `.zeno/docs/architecture/system-overview.md`

### Gate Lifecycle Template
- **File**: `gate-lifecycle-template.md`
- **Purpose**: State machine for workflow processes
- **Output**: `.zeno/docs/architecture/gate-lifecycle.md`

### Data Flow Template
- **File**: `data-flow-template.md`
- **Purpose**: End-to-end data flow diagrams
- **Output**: `.zeno/docs/architecture/data-flow.md`

### Gate Roadmap Template
- **File**: `gate-roadmap-template.md`
- **Purpose**: Gate roadmap with gate progression
- **Output**: `.zeno/docs/architecture/gate-roadmap.md`

**See**: `architecture-templates/README.md` for detailed usage instructions

---

## Markdown Templates

**Location**: `md-templates/`

General-purpose markdown templates:

### AGENTS.md Template
- **File**: `agents-template.md`
- **Purpose**: AI agent instructions for project navigation
- **Output**: `AGENTS.md` (root) or `.zeno/AGENTS.md`

### Project PRD Template
- **File**: `project-prd-template.md`
- **Purpose**: Comprehensive project requirements document
- **Output**: `.zeno/docs/PROJECT_PRD.md`

### Generic Architecture Diagram Template
- **File**: `architecture-diagram-template.md`
- **Purpose**: Single-diagram template for custom architecture docs
- **Output**: Custom architecture documentation

---

## Usage

### Via Zeno CLI

Templates are automatically used by Zeno's Planner CLI:

```bash
# Initialize project (uses agents-template.md, project-prd-template.md)
zeno init

# Generate architecture (uses architecture-templates/)
zeno arch generate

# Generate specific diagram
zeno arch generate --type system-overview
zeno arch generate --type gate-lifecycle
zeno arch generate --type data-flow
zeno arch generate --type gate-roadmap
```

### Manual Usage

To use templates manually:

1. Copy the appropriate template file
2. Replace all `[PLACEHOLDER]` values
3. Update Mermaid (simple) or DOT (complex) diagrams to match your architecture
4. Fill in all description sections
5. Save to the appropriate location in your project

---

## Template Design Principles

### 1. Self-Contained Documentation
Each template produces a complete, standalone document with:
- Embedded diagrams
- Detailed descriptions
- Design rationale
- Related documentation links

### 2. No Duplication
Architecture templates generate individual `.md` files, not a consolidated document. This prevents parity issues between source and documentation.

### 3. Placeholder Consistency
All templates use standard placeholders:
- `[DATE]` - ISO format date (YYYY-MM-DD)
- `[NAME]` - Component/gate/state names
- `[DESCRIPTION]` - Text descriptions
- `[DIAGRAM_CONTENT]` - Mermaid or DOT source code

### 4. Hybrid Diagrams
Use Mermaid for simple diagrams with minimal blocks; use DOT + Graphviz SVGs for complex diagrams for:
- High-fidelity, scalable visuals
- Stable, deterministic rendering
- Large-diagram readability
- SVG embedding in markdown

---

## Adding New Templates

To add a new template:

1. **Determine category**: Architecture diagram or general markdown?
2. **Create template file**: Use existing templates as reference
3. **Add placeholders**: Use `[PLACEHOLDER]` format
4. **Document usage**: Update appropriate README
5. **Test generation**: Verify CLI can use the template

### Template Checklist

- [ ] Clear purpose statement at top
- [ ] All placeholders in `[BRACKETS]`
- [ ] Mermaid diagrams (simple) or DOT diagrams with SVG output (complex)
- [ ] Description sections
- [ ] Related documentation links
- [ ] Source file reference at bottom
- [ ] Consistent formatting with existing templates

---

## Template Maintenance

### When to Update Templates

- New diagram types added to Zeno's methodology
- Improved documentation patterns discovered
- User feedback on generated documentation
- New Mermaid or Graphviz/DOT features become available

### Versioning

Templates follow Zeno's Planner version:
- Major version: Breaking changes to template structure
- Minor version: New sections or optional features
- Patch version: Clarifications and fixes

---

## Related Documentation

- **Architecture Templates README**: `architecture-templates/README.md`
- **Project PRD**: `../docs/PROJECT_PRD.md`
- **AGENTS.md**: `../AGENTS.md`

---

**Last Updated**: 2026-01-04  
**Version**: 1.0.0  
**Maintained by**: Zeno's Planner Development Team

