# Architecture Templates

Templates for generating architecture documentation for target projects managed by Zeno's Planner.

---

## Overview

Zeno's Planner uses intelligent template selection to generate architecture documentation based on target project type, complexity, and gate requirements. Not every project needs every diagram - Zeno generates only what's valuable for your specific project.

**Total Templates Available**: 10

---

## Core Templates (Project-Level)

These templates apply to the overall project and are typically generated once during initial planning:

### 1. System Overview (`system-overview-template.md`)
**Purpose**: High-level system architecture showing layers and components  
**When**: Generated during project initialization or Gate 1  
**Scope**: Entire system  
**Diagram Type**: Mermaid graph with layered subgraphs

**Key Sections**:
- Layered architecture diagram
- Component descriptions by layer
- Design principles
- Component interaction patterns

---

### 2. Data Flow (`data-flow-template.md`)
**Purpose**: End-to-end process flow from start to completion  
**When**: Generated during project initialization or Gate 1  
**Scope**: Entire system  
**Diagram Type**: Mermaid flowchart with decision points

**Key Sections**:
- Flowchart diagram with decision points
- Flow phases
- Data transformations table
- Storage operations
- Feedback loops
- Error handling

---

### 3. Gate Roadmap (`gate-roadmap-template.md`)
**Purpose**: Project roadmap showing gate sequence, dependencies, and parallel work opportunities  
**When**: Generated during project initialization  
**Scope**: Project timeline/gates  
**Diagram Type**: Mermaid graph showing gate relationships

**Key Sections**:
- Gate roadmap diagram (gates only, no feature-level details)
- Parallel gate identification
- Gate groupings and sequencing logic
- Critical path analysis

---

### 4. Lifecycle (`lifecycle-template.md`)
**Purpose**: State machine for any entity or process lifecycle  
**When**: Generated during project initialization or per gate for entity lifecycles  
**Scope**: Workflow or entity lifecycle  
**Diagram Type**: Mermaid state diagram

**Key Sections**:
- State machine diagram
- State descriptions by phase
- State transitions and feedback loops
- Decision points
- Quality gates/checkpoints

**Note**: This is a general-purpose template. For Zeno itself, it documents gate/proposal workflow. For target projects, it can document order lifecycles, user account states, document approval flows, feature flag states, etc.

---

### 5. Context Diagram (`context-diagram-template.md`)
**Purpose**: System boundary and external interactions  
**When**: Generated during project initialization or Gate 1  
**Scope**: System + external dependencies  
**Diagram Type**: Mermaid graph with central system node

**Key Sections**:
- System boundary visualization
- External actors and systems
- Data flows across boundary
- Security boundaries
- Integration points

---

## Gate-Level Templates

These templates are generated for specific gates when detailed documentation is needed:

### 6. Sequence Diagram (`sequence-diagram-template.md`)
**Purpose**: Temporal interactions for specific use cases  
**When**: Generated per gate when complex workflows need documentation  
**Scope**: Single use case or feature  
**Diagram Type**: Mermaid sequence diagram

**Example Use Cases**:
- User authentication flow
- Payment processing sequence
- Multi-step form submission
- API request/response cycle

**Key Sections**:
- Sequence diagram with actors
- Interaction steps breakdown
- Alternative flows
- Error handling
- Performance considerations

---

### 7. Component Diagram (`component-diagram-template.md`)
**Purpose**: Detailed component structure within a module  
**When**: Generated per gate for complex modules  
**Scope**: Single module or subsystem  
**Diagram Type**: Mermaid class diagram

**Example Use Cases**:
- Authentication module internals
- Payment service architecture
- Domain model structure
- Plugin system design

**Key Sections**:
- Class/component relationships
- Interfaces and contracts
- Design patterns used
- Dependency injection
- Extension points

---

### 8. Package/Module Diagram (`package-diagram-template.md`)
**Purpose**: Code organization and module dependencies  
**When**: Generated per gate when refactoring or organizing code structure  
**Scope**: Source code organization  
**Diagram Type**: Mermaid graph showing directory structure

**Example Use Cases**:
- Monorepo organization
- Clean architecture layers
- Feature-based modules
- Shared utilities structure

**Key Sections**:
- Module structure diagram
- Package/module descriptions
- Dependency rules
- Module boundaries
- Entry points

---

## Infrastructure Templates

These templates document deployment and operational aspects, typically generated for production-ready gates:

### 9. Deployment Diagram (`deployment-diagram-template.md`)
**Purpose**: Runtime infrastructure and deployment architecture  
**When**: Generated for deployment/devops gates  
**Scope**: Production infrastructure  
**Diagram Type**: Mermaid graph showing nodes and artifacts

**Example Use Cases**:
- Cloud deployment (AWS/Azure/GCP)
- Kubernetes cluster setup
- Microservices deployment
- CDN and caching strategy

**Key Sections**:
- Infrastructure components
- Network architecture
- Compute resources
- Data storage
- Monitoring & observability
- CI/CD pipeline

---

### 10. Network Diagram (`network-diagram-template.md`)
**Purpose**: Network topology and communication patterns  
**When**: Generated for deployment/devops gates or complex networking  
**Scope**: Network infrastructure  
**Diagram Type**: Mermaid graph with subnets and communication paths

**Example Use Cases**:
- VPC/subnet configuration
- Security groups and firewalls
- Load balancer setup
- Multi-region networking

**Key Sections**:
- Network zones and topology
- IP addressing strategy
- Firewall rules
- Communication protocols
- Network security

---

## Template Selection Guide

### When to Generate Each Template

**Every Project Gets**:
- System Overview
- Data Flow
- Gate Roadmap
- Lifecycle (for Zeno gate workflow)
- Context Diagram

**Generate When Needed**:
- **Sequence Diagram**: Complex user flows or API interactions
- **Component Diagram**: Large modules that need detailed documentation
- **Package Diagram**: Refactoring code organization or setting up new structure
- **Deployment Diagram**: Preparing for production deployment
- **Network Diagram**: Complex networking requirements or multi-region setup

---

## Template Usage by Project Type

### Simple CLI Tool
✓ System Overview  
✓ Data Flow  
✓ Context Diagram  
✓ Package Diagram  
⚠ Sequence Diagram (if complex commands)  
✗ Deployment Diagram (single binary)  
✗ Network Diagram (not needed)

### Web Application (Monolith)
✓ System Overview  
✓ Data Flow  
✓ Context Diagram  
✓ Sequence Diagram (auth, checkout flows)  
✓ Component Diagram (domain models)  
✓ Package Diagram  
✓ Deployment Diagram  
⚠ Network Diagram (if complex networking)

### Microservices Architecture
✓ System Overview (entire system)  
✓ Data Flow (cross-service flows)  
✓ Context Diagram (all services + externals)  
✓ Sequence Diagram (service interactions)  
✓ Component Diagram (per service)  
✓ Package Diagram (per service)  
✓ Deployment Diagram (orchestration)  
✓ Network Diagram (service mesh, VPCs)

### Library/SDK
✓ System Overview (API structure)  
✓ Context Diagram (consumer integration)  
✓ Component Diagram (public API)  
✓ Package Diagram (exports)  
⚠ Sequence Diagram (usage examples)  
✗ Deployment Diagram (not applicable)  
✗ Network Diagram (not applicable)

---

## Usage Instructions

### For Zeno's Planner CLI

When generating architecture documentation:

```bash
# Generate specific diagram types
zeno arch generate --type system-overview
zeno arch generate --type lifecycle
zeno arch generate --type data-flow
zeno arch generate --type gate-roadmap
zeno arch generate --type context

# Generate all core diagrams
zeno arch generate --all-core

# Generate gate-specific diagrams
zeno arch generate --type sequence --use-case "user-authentication"
zeno arch generate --type component --module "payment-service"

# Generate infrastructure diagrams
zeno arch generate --type deployment --env production
zeno arch generate --type network
```

The CLI will:
1. Read the appropriate template from this directory
2. Analyze the project structure and gate requirements
3. Generate Mermaid diagram content based on project analysis
4. Fill in template placeholders with intelligent defaults
5. Write to `.zeno/architecture/[type].md`

### Manual Usage

To create architecture documentation manually:

1. Copy the appropriate template file
2. Rename to match your diagram (e.g., `system-overview.md`)
3. Replace all `[PLACEHOLDER]` values with actual content
4. Update the Mermaid diagram to match your architecture
5. Fill in all description sections with bracketed guidance
6. Save to `.zeno/architecture/` in your project

---

## Template Placeholders

All templates use standard placeholders with bracketed generation instructions:

- `[DATE]` - Generation date (YYYY-MM-DD format)
- `[Draft/Approved/Implemented]` - Document status
- `[Generate a Mermaid diagram...]` - LLM generation instructions
- `[Describe X with Y criteria]` - Content generation guidance
- `[Entity/Process Name]` - Specific names for the target project

**Design Philosophy**: Bracketed instructions guide LLM generation but don't appear in final output.

---

## Diagram Best Practices

### Mermaid Diagram Guidelines

1. **Keep diagrams focused**: 5-15 nodes maximum per diagram
2. **Use consistent styling**: Define CSS classes for node types
3. **Show critical paths**: Emphasize important flows with thicker lines
4. **Include legends**: Use notes to explain symbols or conventions
5. **Version control**: Diagrams are `.mmd` files in git

### When to Split Diagrams

- **Too many nodes**: >20 nodes indicates need for multiple diagrams
- **Multiple concerns**: Split by architectural layer or domain
- **Different audiences**: Create simplified and detailed versions
- **Lifecycle differences**: Separate diagrams that change at different rates

### Styling Mermaid Diagrams

All templates include basic Mermaid styling. Customize colors and styles:

```mermaid
classDef customStyle fill:#COLOR,stroke:#COLOR,stroke-width:2px,color:#fff
class Component1,Component2 customStyle
```

### Diagram Maintenance

- **Update with code**: Diagrams should evolve with implementation
- **Gate milestones**: Review and update diagrams at gate completion
- **Refactoring gates**: Diagram updates may drive refactoring gates
- **Documentation debt**: Track outdated diagrams as technical debt

---

## Design Philosophy

### Single Source of Truth

Each architecture document is self-contained with:
- Embedded Mermaid diagram
- Detailed descriptions
- Design rationale
- Related documentation links

No consolidated `ARCHITECTURE.md` file to prevent synchronization issues.

### Documentation Co-location

Diagram and documentation live together in the same file. When you update the diagram, update the description in the same commit.

### Template-Driven Generation

Templates ensure consistency across projects while allowing customization for specific needs. LLM generates content using bracketed instructions, producing clean output for human review.

### Intelligent Selection

Zeno doesn't generate all 10 diagram types for every project. Selection is based on:
- **Project Type**: CLI tools don't need network diagrams
- **Gate Requirements**: Infrastructure diagrams only for deployment gates
- **Complexity Indicators**: Sequence diagrams when complex workflows detected
- **User Preferences**: Can request specific diagram types

---

## Customization Guidelines

### Adding New Sections

Templates are flexible. Add sections as needed for your project:

```markdown
## Custom Section Title

[Your content here]
```

### Removing Unused Sections

If a section doesn't apply to your project, remove it entirely rather than leaving it empty.

---

## Related Documentation

- **Template Guide**: `templates/README.md` - Overall template guide
- **Project PRD Template**: `templates/md-templates/project-prd-template.md`
- **Gate PRD Template**: `templates/md-templates/gate-prd-template.md`
- **AGENTS Template**: `templates/md-templates/agents-template.md`
- **Root AGENTS.md**: Root-level guide for AI agents using these templates

---

**Last Updated**: 2026-01-04  
**Version**: 1.0.0  
**Status**: Active - 10 Templates Available  
**Maintained by**: Zeno's Planner Development Team
