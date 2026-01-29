# Gate [XX]: [Gate Name]

**Status**: pending  
**Type**: [feature | quality | rescope]  
**Created**: [YYYY-MM-DD]  
**Sequence**: [X of Y]  
**Hash**: #[hash]

<!-- Status lifecycle:
  - pending: Gate generated at init, requirements not yet decomposed
  - in_progress: Gate started via `zeno gates start`, requirements generated
  - completed: All requirements tested, gate approved
  - rejected: Gate rejected during review
-->

## Overview

[2-3 sentences describing what this gate accomplishes and how it moves the project closer to the end state. Focus on concrete deliverables.]

## Objectives

[List 3-5 specific, measurable objectives. Each should have a concrete outcome with clear completion criteria.]

- [ ] [Objective with measurable outcome]
- [ ] [Objective with measurable outcome]
- [ ] [Objective with measurable outcome]

## Context

### What Was Completed Before This Gate
[Summarize previous gate deliverables this builds upon. List key infrastructure or capabilities now available.]

- [Previous capability or infrastructure]
- [Previous capability or infrastructure]

### What This Gate Enables
[Describe future gates or capabilities that depend on this completion. Explain strategic value.]

- [Future capability enabled]
- [Future capability enabled]

### Scope Boundaries
**In Scope**:
[List specific features, modules, or capabilities included in this gate.]
- [Specific deliverable]
- [Specific deliverable]

**Out of Scope**:
[List features explicitly deferred to later gates or intentionally excluded.]
- [Deferred feature]
- [Deferred feature]

## Requirements

<!-- Requirements-First Workflow:
  1. Project-level requirements: PRIMARILY defined during `zeno init` at project inception (BEFORE gates).
     These are high-level, cross-cutting requirements derived from the end state.
  2. Gate generation (`/zeno-gate`): Attributes existing project-level requirements to gates.
     Requirements are PRIMARILY mapped and attributed here, not created.
     During rebaseline/rescope: Requirements may be updated or added as part of rescoping.
  3. Gate start (`zeno gates start`): Generates gate-specific requirements that decompose
     project requirements and gate objectives into actionable items.
  4. Proposal generation (`/zeno-proposal`): Breaks requirements down into individual tasks.
  
  Workflow: Requirements (init - PRIMARY) → Gates (attribute, may update/add during rescope) → Gate Requirements (decompose) → Tasks (proposals)
-->

### Project Requirements (Attributed to This Gate)

[Project-level requirements were defined during `zeno init` at project inception. This section lists those that are attributed to this gate. Query all project requirements via `zeno req list --project`.]

| Hash | Name | Type | Priority | How This Gate Addresses It |
|------|------|------|----------|---------------------------|
| #[hash] | [Project Requirement Name] | [functional\|non_functional\|constraint] | [must\|should\|could] | [How this gate addresses it] |

### Gate-Specific Requirements

[Gate-specific requirements are generated when `zeno gates start <gate-id>` is called. These decompose project requirements and gate objectives into actionable items. Stored in `.zeno/requirements.db` and queried via `zeno req list --gate <id>`.]

**Status**: Requirements will be generated when gate is started.

[After gate start, view detailed requirement information via: `zeno req show <hash>`]

### Inherited/Transferred Requirements

[Requirements transferred from other gates or shared across gates.]

<!-- Requirement sources:
  - Transferred: Requirements moved from another gate (e.g., during rescope)
  - Shared: Requirements that span multiple gates (tracked via dependencies)
-->

- **From Gate [X]**: #[hash] - [Requirement name and reason for transfer]

### Requirement-to-Task Breakdown

[Individual tasks are created during proposal generation (`/zeno-proposal`), not during gate generation. Each requirement may spawn multiple proposals (tasks) that implement it.]

---

## Technical Decisions for This Gate

[List 2-4 gate-specific technical decisions. Focus on choices specific to this gate, not project-wide architecture.]

### [Decision Name]
- **Choice**: [Specific technical decision made for this gate]
- **Alternatives Considered**: [Other options evaluated]
- **Rationale**: [Why this choice for this specific gate]
- **Impact**: [How this affects implementation and future gates]
- **Trade-offs**: [What was gained/lost with this decision]

## Architecture Updates

### Components Modified or Created
[List components that will be created or modified. Include paths, purpose, and key interfaces.]

- **[Component Name]** (`path/to/component`)
  - Purpose: [What this component does]
  - Changes: [What's being added or modified]
  - Interfaces: [Key APIs or contracts]

### Architecture Diagrams
[Specify which diagrams need updates and what changes are required.]

- System Overview: `.zeno/architecture/system-overview.mmd` - [describe specific changes]
- Data Flow: `.zeno/architecture/data-flow.mmd` - [describe specific changes]
- Gate Roadmap: `.zeno/architecture/gate-roadmap.md` - [updated with this gate's position]

### Integration Points
[Describe how this gate's deliverables integrate with existing systems or modules.]

- **[System/Module Name]**: [How integration works]
- **[System/Module Name]**: [How integration works]


## Gate-Specific Quality Considerations

[Only include sections that apply to this gate. Omit if not applicable.]

### Security Considerations
[If this gate involves security-sensitive code, list specific concerns and mitigation approaches.]

- [Security concern and mitigation]
- [Threat model consideration]

### Performance Requirements
[If this gate has specific performance targets, list benchmarks and constraints.]

- [Performance target or benchmark]
- [Resource constraint or optimization goal]

## Dependencies

### External Dependencies (New or Updated)
[List any new npm packages or version updates required. Include justification.]

- **[package-name]** (version) - [Purpose and justification]

### Internal Dependencies
[Specify gate dependencies and module requirements using hash references.]

- **Depends on Gate(s)**: [Gate X: Name] - [What capabilities are required]
- **Blocks Gate(s)**: [Gate Y: Name] - [What gates wait for this completion]
- **Requires Modules**: #[hash] - [module name and why]

### Infrastructure Dependencies
[List any infrastructure changes needed. Omit section if none.]

- [Database schema changes, environment variables, external services, or build system changes]



## Implementation Steps

[List 3-6 high-level steps in execution order. Each step should explain what needs to be done, why it's sequenced this way, and what it enables.]

1. **[Step Name]**
   - [What needs to be done]
   - [Why this step comes first]
   - [What it enables for subsequent steps]

2. **[Step Name]**
   - [What needs to be done]
   - [Dependencies on previous steps]
   - [What it enables for subsequent steps]

3. **[Step Name]**
   - [What needs to be done]
   - [Dependencies on previous steps]
   - [What it enables for subsequent steps]

4. **[Step Name]**
   - [What needs to be done]
   - [Dependencies on previous steps]
   - [Marks gate as ready for completion]

## Known Issues & Limitations

### Current Limitations
[List limitations introduced or accepted by this gate and explain why they exist.]

- [Limitation and rationale]

### Technical Debt
[List technical debt being introduced with plan to address.]

- [Technical debt item] - [plan to address]

### Future Improvements
[List enhancements deferred to later gates.]

- [Enhancement] - [deferred to Gate X]

## Risks & Mitigation

[Identify 2-5 significant risks specific to this gate. Include both technical and process risks.]

### Technical Risks
1. **[Risk Name]**
   - **Impact**: [High/Medium/Low]
   - **Probability**: [High/Medium/Low]
   - **Mitigation**: [Specific actions to reduce risk]
   - **Contingency**: [Backup plan if risk materializes]

### Process Risks
1. **[Risk Name]**
   - **Impact**: [High/Medium/Low]
   - **Probability**: [High/Medium/Low]
   - **Mitigation**: [Specific actions to reduce risk]
   - **Contingency**: [Backup plan if risk materializes]

## Gate Completion Criteria

[Standard checklist for gate completion. All items must be checked before marking gate complete.]

- [ ] All must-have requirements implemented and tested
- [ ] All should-have requirements implemented or explicitly deferred
- [ ] All acceptance criteria met
- [ ] Architecture diagrams updated
- [ ] Gate-specific quality considerations addressed
- [ ] Stakeholder approval obtained

## Notes

### Implementation Notes
[Any additional guidance for implementers not covered above.]

- [Specific guidance or consideration]

### Lessons Learned
[To be filled during/after implementation.]

- [What worked well]
- [What could be improved]
- [Unexpected challenges]

### Next Gate Preview
[Brief preview of what Gate [XX+1] will focus on and how it builds on this gate's deliverables.]

---

**Document Version**: [MAJOR.MINOR.PATCH]  
**Last Updated**: [YYYY-MM-DD]  
**Versioning**: SemVer; bump on any change (minimum: PATCH).  
**Gate Owner**: [git.user.name]  
**Reviewers**: [git.user.name]

### Change Log

| Version | Date | Summary | Author |
|---------|------|---------|--------|
| 1.0.0 | [YYYY-MM-DD] | Initial version | [git.user.name] |

**Related Documents**:
- Project PRD: `docs/PROJECT_PRD.md`
- Previous Gate: `gates/gate-[XX-1]-[name].md`
- Next Gate: `gates/gate-[XX+1]-[name].md`
- Architecture: `docs/architecture/`

