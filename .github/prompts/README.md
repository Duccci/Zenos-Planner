# VS Code Prompts for Zeno's Planner

Prompt files for VS Code Copilot Chat with Ollama Qwen3 models.

## Setup

1. Install Ollama: `ollama pull qwen3-coder:30b`
2. Configure VS Code: Settings → Copilot Chat → Ollama + `qwen3-coder`
3. Use in chat: `/zeno-apply`, `/zeno-gate`, `/zeno-proposal`, `/zeno-archive`

## Prompts

| Prompt | Usage |
|--------|-------|
| `/zeno-apply` | `/zeno-apply "#p01..."` - Implement approved proposal |
| `/zeno-gate` | `/zeno-gate` or `--rebaseline` - Generate/regenerate gates |
| `/zeno-proposal` | `/zeno-proposal gate-01` - Generate proposals from gate |
| `/zeno-archive` | `/zeno-archive gate-01` or `#p01...` - Archive completed work |

## Format

YAML frontmatter + Markdown instructions, compatible with VS Code and Ollama.

## Reference

- `AGENTS.md` (root) - Tool usage and quick reference
- `zeno/README.md` - Project-specific conventions (load on-demand)
- `zeno/PROJECT_PRD.md` - Project requirements and scope
