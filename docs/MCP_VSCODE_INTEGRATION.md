# VS Code MCP Integration

This document explains how Zeno integrates with VS Code's Chat view and MCP tool discovery.

## Tool Discovery
- VS Code will find MCP servers defined in `mcp.json` and populate the Chat view tool picker with tool `title` and `description`.
- Use `#tool-name` in chat to explicitly reference a tool (e.g., `#proposal_show`).

## Chat View Usage
- Open the Chat view and choose the Zeno server from the tool picker. Examples:
  - `#proposal_list { "gate": "gate-03" }` — list proposals for a gate
  - `#proposal_show { "hash": "#g03p05vscode" }` — show proposal details

## Command Palette
- Useful commands: `MCP: List Servers`, `MCP: Reset Cached Tools`.

## Development Mode
- To test tool changes locally, run the MCP server in development mode (see `docs/MCP_DEVELOPMENT.md`) and reload the MCP server in VS Code.

## Troubleshooting
- If a tool is missing in the picker, run `zeno mcp diagnostics` and confirm the tool is listed.
- Ensure server logs are visible in the Output panel. For debugging, enable verbose logs.
