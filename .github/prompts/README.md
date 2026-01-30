# VS Code Prompts for Zeno's Planner

These prompt files are formatted for use with VS Code's AI chat features, specifically compatible with Ollama Qwen3 models.

## Setup

1. **Install Ollama and pull Qwen3 model**:
   ```powershell
   ollama pull qwen3-coder:30b
   ```

2. **Configure VS Code**:
   - Open VS Code Settings
   - Navigate to Copilot Chat settings
   - Select Ollama as provider
   - Choose `qwen3-coder` model

3. **Using prompts**:
   - Open Copilot Chat sidebar (top right)
   - Type `/zeno-apply`, `/zeno-gate`, `/zeno-proposal`, or `/zeno-archive`
   - VS Code will load the corresponding prompt file

## Available Prompts

### `/zeno-apply`
Implement an approved Zeno proposal and track task completion.

**Usage**: `/zeno-apply #p01projconf01` or `/zeno-apply 01-project-configuration`

### `/zeno-archive`
Archive a completed artifact (gate or proposal) and update dependent artifacts.

**Usage**: 
- `/zeno-archive #p01projconf01` (archive proposal)
- `/zeno-archive gate-01` (archive gate)

### `/zeno-gate`
Dynamically generate or regenerate gates to rebaseline project scope.

**Usage**: `/zeno-gate` (for new gates) or `/zeno-gate --rebaseline` (for rebaseline)

### `/zeno-proposal`
Generate proposal documents from a Gate PRD for implementation.

**Usage**: `/zeno-proposal gate-01`

### `/user-instructions`
Core user preferences and communication guidelines for AI interactions.

**Usage**: Reference this file or include its content in custom prompts to apply user preferences consistently.

## Format

These prompts use VS Code's standard prompt file format:
- YAML frontmatter with metadata (`name`, `description`, `model`)
- Markdown content with step-by-step instructions
- Compatible with VS Code Copilot Chat and Ollama integration

## User Instructions

The `user-instructions.prompt.md` file contains core preferences and communication guidelines:
- Response shortcuts (c/continue, r/retry, s/summarize)
- PowerShell command formatting standards
- Communication style preferences (direct, professional, no emojis/filler)
- Clarity and assumption guidelines

These instructions can be referenced in custom prompts or included as context for consistent AI behavior.

## Reference

For detailed Zeno's Planner documentation, see:
- `AGENTS.md` (root) - Quick reference guide
- `zeno/AGENTS.md` - Detailed project-specific guide
- `zeno/PROJECT_PRD.md` - Project requirements and scope
