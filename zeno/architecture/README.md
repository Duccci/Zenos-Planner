# Architecture Documentation

This directory contains architecture diagrams and documentation for Zeno's Planner.

## File Structure

Each architecture diagram is contained in a single `.md` file with embedded Mermaid diagrams, descriptions, and context.

## Available Diagrams

### System Overview
- **File**: `system-overview.md`
- **Purpose**: High-level component architecture showing all system layers
- **Use**: Understanding overall system structure and component relationships

### Gate Lifecycle
- **File**: `gate-lifecycle.md`
- **Purpose**: State machine showing complete gate and proposal workflow
- **Use**: Understanding gate states, transitions, and feedback loops

### Data Flow
- **File**: `data-flow.md`
- **Purpose**: End-to-end data flow from user input to project completion
- **Use**: Understanding how data moves through the system

### Gate Roadmap Diagram
- **File**: `gate-roadmap.md`
- **Purpose**: Gate roadmap with parallel relationships and Zeno's paradox progression
- **Use**: Understanding project structure and which gates can run in parallel

## Editing Guidelines

### To Update a Diagram

1. **Edit the `.md` file directly** - This is the source of truth
2. Update the embedded Mermaid diagram within the markdown code block

### To Add a New Diagram

1. Create `diagram-name.md` with full documentation and embedded Mermaid diagram
2. Use `templates/architecture-templates/` as a starting point
3. Update this README with the new diagram

## Why This Structure?

**Problem**: Having separate `.mmd` files duplicates content and creates sync issues.

**Solution**: Each diagram is self-contained in its own `.md` file with:
- Embedded Mermaid diagram
- Detailed description
- Design rationale
- Related documentation links

**Benefits**:
- Single source of truth per diagram
- No duplication between `.md` and `.mmd` files
- Easy to view and edit
- Version control friendly

## Viewing Diagrams

### In Visual Studio Code
1. Install "Markdown Preview Mermaid Support" extension
2. Open any `.md` file
3. Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)

### In GitHub
- GitHub natively renders Mermaid diagrams in markdown files

### In Other Viewers
- Most modern markdown viewers support Mermaid
- Alternatively, use [Mermaid Live Editor](https://mermaid.live/)

---

**Last Updated**: 2026-01-04  
**Maintained by**: Zeno's Planner Development Team

