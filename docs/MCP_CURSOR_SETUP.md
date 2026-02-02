# MCP Integration for Cursor

Cursor (VS Code-based) can use workspace `mcp.json` or run a lightweight adapter activation script.

Quick steps:
1. Prefer workspace `.vscode/mcp.json` using the `mcp.json.template`.
2. If not available, run the adapter activation command:

   node ./bin/mcp-server.js --adapter cursor

3. Verify the Cursor tool picker shows Zeno tools and try a sample invocation like `#proposal_list`.

Notes:
- Adapter uses stdio transport by default; if your Cursor environment requires a WebSocket, see `src/mcp/editor-adapters.ts` for activation command generation.
