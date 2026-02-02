# MCP Server Setup for VS Code

This guide shows how to configure VS Code to discover and use the Zeno MCP server.

## Quick Start
1. Add `mcp.json` to your workspace (create `.vscode/mcp.json`) and copy the contents of `mcp.json.template`.
2. Ensure `ZENO_PROJECT_ROOT` resolves to your workspace root (the template uses `${workspaceFolder}`).
3. Start the MCP server (workspace-local):
   - From terminal: `node ./bin/mcp-server.js`
   - Or via CLI: `zeno mcp server`
4. Open the VS Code Chat view and verify Zeno tools appear in the tool picker.

## Where to put `mcp.json`
- Workspace: `.vscode/mcp.json` (recommended for project-specific settings)
- User: `%APPDATA%\Code\User\mcp.json` (Windows) or `$HOME/.config/Code/User/mcp.json` (Linux/macOS)

## Verification
- When server is running, `zeno mcp diagnostics` returns a readable report of registered tools.
- Use `zeno mcp run -t proposal_list` to validate a sample tool invocation locally.

## Troubleshooting
- If tools don't appear: ensure VS Code version >= 1.102 with MCP support and that `mcp.json` is valid JSON.
- On Windows, ensure Node is in PATH and `ZENO_PROJECT_ROOT` points to the workspace root.
- Use `zeno mcp diagnostics` and check the Output panel for MCP logs.

## Notes
- The template uses stdio transport (recommended for local workflows).
- For editors that don't support workspace-level `mcp.json`, see adapter docs for Cursor/Windsurf in `docs/`.
