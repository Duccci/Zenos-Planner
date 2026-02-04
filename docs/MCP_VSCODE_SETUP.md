# MCP VS Code Setup Guide

This guide explains how to set up the Zeno Planner MCP server in VS Code.

## Installation

1. Install the MCP server using the installer:
   ```bash
   zeno mcp install
   ```

2. The installer will create a `.vscode/mcp.json` file in your workspace.

3. Restart VS Code to enable the MCP server.

## Configuration

The `.vscode/mcp.json` file contains:
```json
{
  "servers": {
    "zeno-planner": {
      "type": "stdio",
      "command": "node",
      "args": ["./bin/mcp-server.js"],
      "description": "Zeno Planner MCP server for AI-powered project management",
      "env": {
        "ZENO_WORKSPACE": "${workspaceFolder}"
      }
    }
  }
}
```

## Usage

Once configured, Zeno tools will be available in the VS Code Chat view tool picker.

## Troubleshooting

If tools don't appear, check:
- VS Code version is 1.102+
- The `.vscode/mcp.json` file exists
- The MCP server is running without errors

For more details, see the main README.md.