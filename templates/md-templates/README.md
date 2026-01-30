# Markdown Document Templates

Templates for generating project documentation for target projects managed by Zeno's Planner.

---

## Overview

Zeno's Planner uses templates to generate comprehensive documentation that guides both human stakeholders and AI assistants through project planning and implementation. These templates produce clean, professional documents ready for human review and approval.

**Total Templates Available**: 4

**Design Philosophy**: Templates contain bracketed generation instructions `[instruction]` that guide the LLM on what to generate. The final output is clean, professional documentation focused on decision-making content without meta-commentary.

---

## Available Templates

### 1. Project PRD (`project-prd-template.md`)

**Purpose**: High-level project Product Requirements Document  
**When**: Generated during project initialization (`zeno init`)  
**Scope**: Entire project/repository  
**Audience**: Stakeholders, project leads, AI assistants

**Key Sections**:
- **Overview**: Project description and problem statement (2-3 paragraphs)
- **Project Dependencies**: External packages, internal modules, infrastructure requirements
- **User Stories**: Primary users, edge cases, and secondary scenarios
- **Key Technical Decisions**: Major architectural choices with alternatives, rationale, and trade-offs
- **Architecture Principles**: 3-6 core principles guiding system design
- **Timeline (Order of Operations)**: 8-15 sequential gates with high-level objectives
- **Open Questions**: Technical, product, blockers, and concerns
- **Risk Mitigation**: Technical and process risks with impact, probability, mitigation, and fallback
- **Success Criteria**: Technical, functional, and UX metrics
- **Architecture**: References to Mermaid diagrams (generated separately)
- **Data Models**: Core data structures, relationships, and API contracts
- **Out of Scope**: Explicitly excluded features and deferred items

**Usage**:
```bash
zeno init  # Generates PROJECT_PRD.md at .zeno/PROJECT_PRD.md
```

**Generation Guidance**:
- Generate 8-15 gates in sequential order
- Each gate should list 3-5 high-level objectives
- Focus on project-wide strategic decisions, not gate-specific choices
- Be specific and quantifiable in success criteria

---

### 2. Gate PRD (`gate-prd-template.md`)

**Purpose**: Gate-specific Product Requirements Document  
**When**: Generated when starting a gate (`zeno gates start <gate-id>`)  
**Scope**: Single gate (milestone)  
**Audience**: Developers, AI implementers, reviewers

**Key Sections**:
- **Overview**: 2-3 sentences on what this gate accomplishes
- **Objectives**: 3-5 specific, measurable objectives with completion criteria
- **Context**: What was completed before, what this enables, scope boundaries
- **Requirements**: References to requirements from the database (`.zeno/requirements.db`)
  - Listed by hash reference (#hash)
  - Brief summary of each requirement
  - Requirements are queried/viewed via `zeno req list --gate <id>`
  - Detailed requirement data lives in database, not in this document
- **Technical Decisions for This Gate**: Gate-specific technical choices (not project-wide)
- **Architecture Updates**: Components modified/created, diagram changes, integration points
- **Gate-Specific Quality Considerations**: Security and performance requirements (if applicable)
- **Dependencies**: External packages, internal dependencies, infrastructure changes
- **Implementation Steps**: 3-6 high-level steps in execution order
- **Known Issues & Limitations**: Current limitations, technical debt, future improvements
- **Risks & Mitigation**: Technical and process risks specific to this gate
- **Gate Completion Criteria**: Checklist for marking gate complete

**Usage**:
```bash
zeno gates start <gate-id>  # Generates gate PRD at .zeno/gates/gate-XX-name.md
zeno gates show <gate-id>   # View generated gate PRD
```

**Generation Guidance**:
- Requirements are stored in `.zeno/requirements.db` and referenced by hash
- Gate PRD lists requirement hashes with brief summaries
- Detailed requirement structure (type, priority, acceptance criteria, dependencies) lives in database
- Implementation steps are high-level; detailed tasks come from proposals
- Focus on gate-specific decisions, not overall project architecture
- Use hash references (#hash) for all dependencies

---

### 3. Proposal (`proposal-template.md`)

**Purpose**: Lightweight implementation proposal driven by gates/requirements  
**When**: Generated when starting gate work or creating new proposals (`zeno proposal create`)  
**Scope**: Single implementation unit (typically 1-5 files)  
**Audience**: LLM implementers, human reviewers

**Key Sections**:
- **Summary**: 2-3 sentence outcome description
- **Context**: Why this change is needed, dependency references
- **Tasks**: Atomic, LLM-executable tasks with file paths and acceptance criteria
- **Files Affected**: Table of files and actions (create/modify/delete)
- **Implementation Notes**: Optional technical guidance
- **Rollback**: Reversion strategy if rejected

**Usage**:
```bash
zeno proposal create "Add hash utility module"  # Generates proposal in proposals/active/gate-XX/
zeno proposal list                              # List active proposals
zeno proposal show <hash>                       # View proposal details
zeno proposal validate <hash>                   # Run automated checks
```

**Generation Guidance**:
- Tasks must be atomic: one task = one focused implementation session
- Each task specifies exact file paths and action type
- Acceptance criteria must be verifiable (testable, observable)
- Always include test tasks with coverage expectations
- Use hash references for all dependencies
- Keep proposals small: 3-7 tasks is typical; split larger work

**Design Principles**:
- **Lightweight**: Minimal metadata, maximum actionability
- **LLM-Optimized**: Tasks are directly executable without interpretation
- **Human-Reviewable**: Clear structure for approval decisions
- **Gate-Driven**: Always linked to a gate and optionally a requirement

---

### 4. AGENTS.md (`agents-template.md`)

**Purpose**: AI agent context guide for target project  
**When**: Generated during project initialization and updated at major milestones  
**Scope**: Entire project  
**Audience**: AI coding assistants (LLMs)

**Key Sections**:
- **Project Overview**: Name, type, tech stack, architecture, end state
- **Quick Navigation**: Table of where to find key information
- **Understanding Zeno's Planner Concepts**: 
  - Core methodology (iterative gate decomposition)
  - Hash-based references
  - Hybrid storage model
  - Quality gates
- **Project Structure**: Directory tree with descriptions
- **Reading Zeno Artifacts**: How to interpret gates, requirements, proposals
- **Common Workflows**: Step-by-step workflows with AI assistant tasks
- **CLI Command Reference**: Complete command list with examples
- **Best Practices for AI Assistants**: Do's and don'ts
- **Troubleshooting**: Common issues and resolutions
- **Quality Metrics**: How coverage, security, and linting are calculated
- **Example Flows**: Complete gate implementation examples

**Usage**:
```bash
zeno init  # Generates AGENTS.md at .zeno/AGENTS.md
# Updated automatically as project evolves
```

**Generation Guidance**:
- Replace placeholders: {{PROJECT_NAME}}, {{PROJECT_TYPE}}, {{TECH_STACK}}, {{END_STATE}}
- Include project-specific examples from actual gates
- Update CLI commands to reflect actual gate names
- Keep focused on "how to read this codebase" not general Zeno usage

**Note**: This template is unique - it's documentation FOR the AI, not generated BY the AI. It explains Zeno concepts and project conventions to help AI assistants understand the codebase.

---

## Template Hierarchy

```
Project Level
└── PROJECT_PRD.md (project-prd-template.md)
    └── AGENTS.md (agents-template.md)
    └── Gates
        ├── Gate 1 PRD (gate-prd-template.md)
        │   ├── Proposal A (proposal-template.md)
        │   ├── Proposal B (proposal-template.md)
        │   └── Proposal N (proposal-template.md)
        ├── Gate 2 PRD (gate-prd-template.md)
        │   └── Proposals...
        └── Gate N PRD (gate-prd-template.md)
            └── Proposals...
```

**Relationships**:
- **Project PRD** defines overall scope, decisions, and timeline
- **AGENTS.md** explains how to read all artifacts
- **Gate PRDs** decompose project into actionable milestones
- **Proposals** provide atomic implementation units within gates
- Each proposal references its gate and optionally a specific requirement

---

## Usage Instructions

### For Zeno's Planner CLI

```bash
# Initialize new project (generates PROJECT_PRD.md + AGENTS.md)
zeno init

# Start a gate (generates gate PRD)
zeno gates start <gate-id>

# View project PRD
cat .zeno/PROJECT_PRD.md

# View gate PRD
zeno gates show <gate-id>

# View AI context guide
cat .zeno/AGENTS.md
```

### Manual Usage

To create documentation manually:

1. Copy the appropriate template file
2. Replace all `[PLACEHOLDER]` values with actual content
3. Follow bracketed generation instructions `[Generate X with Y criteria]`
4. Remove instructional brackets in final output
5. Save to appropriate location:
   - Project PRD: `.zeno/PROJECT_PRD.md`
   - Gate PRD: `.zeno/gates/gate-XX-name.md`
   - AGENTS.md: `.zeno/AGENTS.md`

---

## Template Placeholders

All templates use standard placeholders:

### Hash References

All `#hash` references in generated documents (e.g., `#a3f9c2d1`) resolve to entities stored in the SQLite database (`.zeno/requirements.db`). Hashes are registered in the `hash_registry` table and point to gates, requirements, proposals, artifacts, or repositories.

**LLM Resolution**: When processing proposals or other artifacts, the LLM automatically resolves hash references by querying the database. No manual lookup required.

**Database Tables**:
- `hash_registry` - Central lookup: hash -> entity_type + entity_id
- `dependencies` - Tracks requires/blocks relationships between hashes
- `requirements`, `gates`, `proposals` - Entity tables with hash columns

### Simple Replacements
- `[Project Name]` - Name of the target project
- `[DATE]` - Generation date (YYYY-MM-DD)
- `[XX]` - Gate number (01, 02, etc.)
- `[hash]` - SHA-256 hash reference (first 16 chars, from `hash_registry`)

### Generation Instructions
- `[Generate X items with Y criteria]` - Tells LLM what to produce
- `[Describe X in Y paragraphs]` - Guides content generation
- `[List X-Y items]` - Specifies quantity

### Placeholders for AGENTS.md
- `{{PROJECT_NAME}}` - Replace with actual project name
- `{{PROJECT_TYPE}}` - CLI Tool / Web App / Library / etc.
- `{{TECH_STACK}}` - Technology stack specifics
- `{{ARCHITECTURE_STYLE}}` - Layered / Microservices / etc.
- `{{END_STATE}}` - Project end goal
- `{{VERSION}}` - Document version
- `{{DATE}}` - Last updated date
- `{{STATUS}}` - Active / Draft / Archived

---

## Document Best Practices

### PRD Best Practices

1. **Be Specific**: Avoid vague descriptions; use concrete examples
2. **Quantify Success**: Metrics should be measurable (90% coverage, <100ms latency)
3. **Document Decisions**: Capture alternatives considered and why choices were made
4. **Hash References**: Use #hash for all cross-references, not file paths
5. **Out of Scope**: Explicitly list what's NOT included to prevent scope creep

### Gate PRD Best Practices

1. **Clear Objectives**: Each objective should have completion criteria
2. **Granular Requirements**: Sized for single proposals, not too big or small
3. **Implementation Order**: Steps should show logical dependencies
4. **Gate-Specific**: Don't repeat project-wide decisions from Project PRD
5. **Actionable**: Focus on what to build, not how to build it

### Proposal Best Practices

1. **Atomic Tasks**: Each task should be completable in one focused session
2. **Specific Files**: Always include exact file paths, not directories
3. **Verifiable Acceptance**: Criteria must be testable or observable
4. **Test Coverage**: Every proposal should include test tasks
5. **Small Scope**: 3-7 tasks typical; split larger work into multiple proposals
6. **Hash References**: Use hashes for all dependency references
7. **Clear Actions**: Specify create/modify/delete/refactor for each file

### AGENTS.md Best Practices

1. **Project-Specific**: Include actual examples from the project
2. **Quick Navigation**: First table should help AI find info quickly
3. **Command Examples**: Show real commands with project-specific names
4. **Workflow Examples**: Include complete flows from start to finish
5. **Keep Updated**: Regenerate when project structure changes significantly

---

## Design Philosophy

### Templates Guide LLM Generation

Templates contain bracketed instructions that tell the LLM:
- **What** to generate (content type)
- **How much** to generate (quantity)
- **What quality** to target (specificity, detail level)

Example:
```markdown
[Generate 8-15 gates in sequential order. Each gate should list 3-5 high-level objectives.]
```

### Clean Output for Humans

Generated documents are clean and professional:
- No bracketed instructions in output
- No meta-commentary about the template
- No instructional text for the LLM
- Focus on decision-making content

### Human-Focused Content

Documents prioritize what humans need to review and approve:
- Strategic decisions with rationale
- Clear success criteria
- Risk analysis and mitigation
- Scope boundaries (in/out)

### LLM-Friendly Structure

Documents help AI assistants:
- Hash-based references reduce context size
- Structured format enables parsing
- Clear hierarchies aid navigation
- AGENTS.md provides interpretation guide

---

## Document Lifecycle

### Project PRD
1. **Generated**: During `zeno init`
2. **Updated**: When rescoping (`zeno rescope`)
3. **Status**: Living document, updated as project evolves
4. **Version Control**: Committed to git with project

### Gate PRD
1. **Generated**: When starting gate (`zeno gates start`)
2. **Updated**: Rarely - gates are immutable once started
3. **Completed**: Marked complete when all requirements done
4. **Archived**: Tagged in git (`gate-XX-name`)

### Proposal
1. **Generated**: When starting gate (`zeno gates start`) or explicitly via `zeno proposal create`
2. **Lifecycle**: draft -> pending_check -> pending_approval -> approved -> implemented
3. **Active**: Organized by gate in `zeno/proposals/active/gate-XX/<name>.md` (e.g., `zeno/proposals/active/gate-02/02-metrics-graph.md`)
4. **Archived**: Moved to `zeno/proposals/completed/<hash>.md` on implementation
5. **Rejected**: Moved to `zeno/proposals/rejected/<hash>.md` with feedback preserved

### AGENTS.md
1. **Generated**: During `zeno init`
2. **Updated**: At major milestones or structural changes
3. **Status**: Living document
4. **Purpose**: Always reflects current project structure

---

## Customization Guidelines

### Adding Sections

Templates are flexible. Add sections as needed:

```markdown
## Custom Section Title

[Content or generation instructions]
```

### Removing Sections

If a section doesn't apply, remove it entirely rather than leaving it empty with placeholder text.

### Project-Specific Adaptations

Adapt templates for your domain:
- Add industry-specific sections (compliance, regulations)
- Include domain-specific metrics
- Use terminology familiar to your team
- Reference external standards (ISO, HIPAA, PCI-DSS)

---

## Related Documentation

- **Architecture Templates**: `templates/architecture-templates/` - Mermaid diagram templates
- **Root README**: `templates/README.md` - Overall template guide
- **Root AGENTS.md**: `AGENTS.md` - General Zeno's Planner usage guide

---

**Last Updated**: 2026-01-04  
**Version**: 1.1.0  
**Status**: Active - 4 Templates Available  
**Maintained by**: Zeno's Planner Development Team

