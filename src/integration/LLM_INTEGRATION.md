# Zeno LLM Integration Guide

This document provides comprehensive guidance for AI agents (LLMs) on how to effectively use Zeno's Planner in assisted development workflows.

## Overview

Zeno's Planner is a project management tool that uses iterative gate-based planning inspired by Zeno's paradox. AI agents can invoke Zeno functions to manage project planning, track progress, and coordinate implementation across multiple development phases.

## Function Categories

### Project Management
- `init()` - Initialize new projects
- `status()` - Get project overview
- `gates_list()` - List all project gates
- `gates_show(gateId)` - Show gate details
- `gates_start(gateId)` - Begin gate work
- `gates_complete(gateId)` - Finish gate

### Requirements Management
- `req_list(gateId?, project?)` - List requirements
- `req_show(hash)` - Show requirement details
- `req_deps(hash)` - Show dependencies
- (removed) `req_status` - Requirement lifecycle is recorded via proposal approvals and gate archival (no DB status)

### Proposal Management
- `proposal_list(gateId?, status?)` - List proposals
- `proposal_show(hash)` - Show proposal details
- `proposal_start(hash)` - Start implementation
- `proposal_validate(hash)` - Run validation
- `proposal_approve(hash)` - Approve completion
- `proposal_reject(hash)` - Reject proposal

### Architecture
- `arch_generate()` - Generate diagrams
- `arch_show(type)` - Show specific diagram

### Utilities
- `show(hash)` - Resolve hash references

## Workflow Patterns

### Project Initialization
```javascript
// Step 1: Initialize project
await init()

// Step 2: Check initial status
const status = await status()
console.log("Project initialized with", status.gates.length, "gates")
```

### Gate-Based Development
```javascript
// Get current gates
const gates = await gates_list()

// Find next pending gate
const nextGate = gates.find(g => g.status === 'pending')
if (nextGate) {
  // Show gate details
  const details = await gates_show(nextGate.id)

  // Start working on gate
  await gates_start(nextGate.id)

  // List requirements for this gate
  const requirements = await req_list(nextGate.id)

  // Process each requirement...
}
```

### Proposal Implementation
```javascript
// List pending proposals
const proposals = await proposal_list(null, 'pending')

for (const proposal of proposals) {
  // Get proposal details
  const details = await proposal_show(proposal.hash)

  // Start implementation
  await proposal_start(proposal.hash)

  // Implement the tasks described in details.tasks

  // Mark requirements as implemented
  for (const req of details.requirements) {
    await req_status(req.hash, 'implemented')
  }

  // Run validation
  const validation = await proposal_validate(proposal.hash)

  if (validation.passed) {
    await proposal_approve(proposal.hash)
  } else {
    // Fix issues and re-validate
  }
}
```

## Error Handling

### Common Error Patterns

**Dependency Errors**
```
Error: Cannot start proposal - dependencies not satisfied
Solution: Check req_deps() and ensure all 'requires' dependencies are completed
```

**Status Transition Errors**
```
Error: Invalid status transition
Solution: Follow proper workflow: pending -> in_progress -> completed/rejected
```

**Validation Failures**
```
Error: Validation failed - check logs
Solution: Run proposal_validate() and fix reported issues
```

### Retry Strategies

1. **Dependency Checks**: Always verify dependencies before starting work
2. **Status Validation**: Check current status before attempting transitions
3. **Incremental Changes**: Make small changes and validate frequently

## Best Practices

### Hash References
- Use full hashes (e.g., "#a3f9c2d1") when calling functions
- Resolve hashes with `show()` to get human-readable names
- Store hash mappings for cross-reference

### State Management
- Check project status regularly with `status()`
- Use `gates_list()` to understand current progress
- Validate proposal status before operations

### Error Recovery
- Log all function calls and responses
- Implement exponential backoff for transient errors
- Provide clear error messages to users

### Performance Considerations
- Cache frequently accessed data (gate lists, requirements)
- Use selective queries rather than fetching all data
- Batch operations when possible

## Integration Examples

### OpenAI Function Calling
```javascript
const functions = getOpenAIFunctionSignatures()

// Use in OpenAI API call
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  functions: functions,
  function_call: "auto"
})
```

### Anthropic Tools
```javascript
const tools = getAnthropicToolSignatures()

// Use in Anthropic API call
const response = await anthropic.messages.create({
  model: "claude-3-sonnet-20240229",
  messages: [...],
  tools: tools,
  tool_choice: "auto"
})
```

## Quality Gates

Zeno enforces these quality standards:
- **Code Coverage**: ≥90% for business logic
- **Security**: 0 known vulnerabilities
- **Linting**: <0.01% error rate
- **TypeScript**: 0 type errors (strict mode)

Always run validation before approving proposals.

## Troubleshooting

### Common Issues

**"Command not found"**
- Ensure Zeno is properly installed
- Check PATH environment variable
- Verify project is initialized with `zeno init`

**"Invalid gate ID"**
- Use `gates_list()` to get valid gate IDs
- Check spelling and case sensitivity

**"Permission denied"**
- Ensure write access to project directory
- Check file system permissions

**"Validation failed"**
- Run `proposal_validate()` to see specific issues
- Fix code quality issues (coverage, linting, types)
- Re-run tests and validation

### Debug Mode
Enable debug logging by setting environment variable:
```
ZENO_DEBUG=1
```

This provides detailed execution logs for troubleshooting.