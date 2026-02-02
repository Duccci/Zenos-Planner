# MCP Server Development Mode

Development mode provides features to enable fast iteration and debugging when working on MCP tools.

## Features
- File watching (debounced) for `src/**/*.ts` to auto-restart the server in development
- Debug logging and verbose output
- `zeno mcp diagnostics` to inspect server health and registered tools

## How to run
1. From project root: `NODE_ENV=development node ./bin/mcp-server.js --dev`
2. Use `zeno mcp diagnostics` to view the diagnostic report
3. Use the VS Code Debugger or the Output panel to view logs

## Notes
- File watching is disabled in production (controlled by `NODE_ENV`).
- If file watching does not restart the server, manually stop and start the server.
