# MCP Integration for Windsurf

Windsurf can connect to a local MCP server via either a workspace `mcp.json` or the adapter activation command.

Quick steps:
1. Add `.vscode/mcp.json` using `mcp.json.template` when possible.
2. Or run:

   node ./bin/mcp-server.js --adapter windsurf

3. Confirm tools are discoverable in Windsurf's tool settings.

Notes:
- Prefer workspace-local configuration. Global installs require admin privileges and are not recommended unless necessary.
