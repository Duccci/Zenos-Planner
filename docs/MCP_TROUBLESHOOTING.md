# MCP Server Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Zeno MCP server integration.

## Connection Issues

### Server Not Starting

**Symptoms**: MCP server fails to start, VS Code shows connection errors.

**Causes**:
- Missing dependencies
- Invalid project configuration
- Port conflicts (if using HTTP transport)

**Solutions**:
1. Check server logs: `zeno mcp server 2>&1 | head -20`
2. Verify project root: `zeno status`
3. Check Node.js version: `node --version` (requires Node 18+)
4. Install dependencies: `npm install`

**Example**:
```bash
$ zeno mcp server
[ERROR] Failed to start MCP server: Cannot find module '@modelcontextprotocol/sdk'
$ npm install
```

### Tools Not Discovered

**Symptoms**: MCP tools don't appear in VS Code Chat, or "tool not found" errors.

**Causes**:
- Server not running
- Tool registration failed
- Schema validation errors

**Solutions**:
1. Check server status: `zeno mcp health`
2. Restart MCP server
3. Check tool registration: `zeno mcp tools`
4. Verify schemas are valid

**Example**:
```bash
$ zeno mcp health
Status: unhealthy
Tools Registered: 0
$ zeno mcp server &
```

### Tools Failing

**Symptoms**: Tools execute but return errors or unexpected results.

**Causes**:
- Invalid input parameters
- Database connectivity issues
- File system permissions

**Solutions**:
1. Check error logs: `zeno mcp errors`
2. Validate input format: `zeno mcp run -t <tool> -j '{"param": "value"}'`
3. Check database: `zeno status`
4. Verify file permissions

## Common Error Messages

### "Gate not found"

**Cause**: Invalid gate ID or gate doesn't exist in project.

**Solutions**:
- List available gates: `zeno gates list`
- Check gate ID format (e.g., `gate-01`, `gate-02`)
- Verify gate exists in project

**Example**:
```bash
$ zeno gates list
#01 completed core infrastructure
#02 completed zeno engine
$ zeno show gate-03  # Should show gate details
```

### "Validation failed"

**Cause**: Input parameters don't match expected schema.

**Solutions**:
- Check tool schema: `zeno mcp tools | grep <tool>`
- Verify parameter types and required fields
- Use correct JSON format for complex inputs

**Example**:
```bash
$ zeno mcp run -t gates_show -j '{"gateId": "gate-01"}'
# Correct format
$ zeno mcp run -t gates_show -j '{"gateId": 1}'
# Error: validation failed - gateId must be string
```

### "Database error"

**Cause**: SQLite database file missing, corrupted, or permission issues.

**Solutions**:
- Check database file exists: `ls zeno/.zeno/requirements.db`
- Verify permissions: `ls -la zeno/.zeno/`
- Reinitialize if corrupted: `rm zeno/.zeno/requirements.db* && zeno init`

**Example**:
```bash
$ ls zeno/.zeno/requirements.db
ls: cannot access 'zeno/.zeno/requirements.db': No such file or directory
$ zeno init
```

### "Project root not found"

**Cause**: ZENO_PROJECT_ROOT environment variable not set or invalid.

**Solutions**:
- Set environment variable: `export ZENO_PROJECT_ROOT=/path/to/project`
- Run from project root directory
- Check .zeno directory exists

## Debugging

### Enable Debug Logging

Set environment variable to see detailed logs:

```bash
export DEBUG=zeno:*
zeno mcp server
```

This shows:
- Tool invocations with parameters
- Database queries
- File operations
- Error stack traces

### Check MCP Server Output in VS Code

1. Open VS Code Output panel (View → Output)
2. Select "Zeno MCP" from dropdown
3. Look for connection messages and errors

### Use Health Check Command

Run comprehensive diagnostics:

```bash
zeno mcp health
```

Shows:
- Server status and uptime
- Number of registered tools
- Configuration status
- Recent errors

### Manual Tool Invocation

Test tools directly via CLI:

```bash
zeno mcp run -t gates_list
zeno mcp run -t req_list -j '{"gateId": "gate-01"}'
```

Compare with VS Code behavior to isolate issues.

## Performance

### Tool Invocation Should Be <100ms

**Symptoms**: Tools take several seconds to respond.

**Causes**:
- Database queries are slow
- File I/O bottlenecks
- Large result sets

**Solutions**:
1. Check database performance: `zeno metrics`
2. Profile operations: `time zeno mcp run -t <tool>`
3. Optimize queries if needed

### Database or File I/O Issues

**Symptoms**: Operations involving database or files are slow.

**Solutions**:
1. Check disk space: `df -h`
2. Verify database integrity: `sqlite3 zeno/.zeno/requirements.db "PRAGMA integrity_check"`
3. Check file permissions
4. Consider database optimization

## Development

### File Watching Disabled in Production

File watching is only active in development mode to avoid unnecessary restarts.

**Enable development mode**:
```bash
NODE_ENV=development zeno mcp server
# or
zeno mcp server --dev
```

### Check FILE_WATCH_PATTERN

Customize watched files:

```bash
export FILE_WATCH_PATTERN='src/**/*.ts'
NODE_ENV=development zeno mcp server
```

### Restart Server Manually

If file watching isn't working:

```bash
# Kill existing server
pkill -f "zeno mcp server"
# Restart
zeno mcp server
```

## Getting Help

If these steps don't resolve your issue:

1. Collect diagnostics: `zeno mcp diagnostics > diagnostics.txt`
2. Check recent commits for changes
3. File a bug report with:
   - VS Code version
   - Node.js version
   - Operating system
   - Full error logs
   - Steps to reproduce

## Quick Reference

| Command | Purpose |
|---------|---------|
| `zeno status` | Project overview |
| `zeno mcp health` | Server health check |
| `zeno mcp diagnostics` | Full diagnostic report |
| `zeno mcp tools` | List registered tools |
| `zeno mcp errors` | Recent error history |
| `DEBUG=zeno:* zeno mcp server` | Debug logging |