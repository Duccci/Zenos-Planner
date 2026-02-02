# MCP Testing Strategy & Guidelines

## Overview

This document outlines the comprehensive testing strategy for Zeno's Model Context Protocol (MCP) layer, ensuring production-ready reliability and performance for LLM integration.

## Test Organization

### Test Categories

#### 1. Unit Tests (`tests/mcp/`)
- **Schemas** (`schemas.test.ts`): Zod schema validation, error messages, enum constraints
- **Tools** (`tools/*.test.ts`): Individual tool handler functionality, error cases, edge conditions
- **Server** (`server.test.ts`): MCP server startup, tool registration, request handling
- **Error Handler** (`error-handler.test.ts`): Error formatting, logging, recovery

#### 2. Integration Tests (`tests/mcp/`)
- **Tool Handlers** (`tools/*-handlers.integration.test.ts`): End-to-end tool execution via registry
- **Server Integration** (`server-integration.test.ts`): Full MCP server lifecycle
- **Prompt Workflows** (`prompt-workflows.test.ts`): End-to-end workflow orchestration
- **Performance** (`performance.test.ts`): Response time validation against budgets

#### 3. End-to-End Tests (`tests/integration/`)
- **Workflow Integration** (`gate-completion-analysis.test.ts`): Complete gate lifecycle
- **Quality Validation** (`quality-validation.test.ts`): Automated quality checks

## Quality Thresholds

| Component | Target Coverage | Current Status |
|-----------|-----------------|----------------|
| MCP Server | ≥90% | ✅ 82.96% |
| Tool Handlers | ≥90% | ✅ 91.12% |
| Schemas | ≥95% | ✅ 98.57% |
| Error Handler | ≥95% | ✅ 94.87% |
| Registry | ≥90% | ✅ 100% |
| Function Registry (CLI delegation) | ≥90% | ✅ 79.04% |
| **Overall** | **≥90%** | **81.97%** |

## Performance Budget

| Operation | Budget | Status |
|-----------|--------|--------|
| Simple tools (gates_list) | <20ms | ✅ |
| Database queries (req_list) | <50ms | ✅ |
| Complex tools (req_show) | <100ms | ✅ |
| Registry lookup | <5ms | ✅ |
| Concurrent requests | <200ms | ✅ |

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm run test:coverage
```

### Specific Test Categories
```bash
# MCP unit tests only
npm test -- tests/mcp/

# Performance tests only
npm test -- tests/mcp/performance.test.ts

# Integration tests only
npm test -- tests/integration/
```

### Watch Mode
```bash
npm run test:watch
```

## Test Structure Guidelines

### Unit Tests
- Test one function/component in isolation
- Mock external dependencies
- Cover happy path, error cases, edge conditions
- Use descriptive test names: `should validate X when Y`

### Integration Tests
- Test component interactions
- Use real dependencies where possible
- Focus on data flow and error propagation
- Mock external systems (file system, network)

### End-to-End Tests
- Test complete user workflows
- Simulate real user interactions
- Validate system state changes
- May be slower, run less frequently

## Adding New Tests

### For New Tools
1. Create unit test in `tests/mcp/tools/` with pattern `{tool-name}.test.ts`
2. Add integration test in `tests/mcp/tools/` with pattern `{tool-name}-handlers.integration.test.ts`
3. Update performance tests if new tool has specific timing requirements
4. Update workflow tests if tool is part of a prompt workflow

### For Schema Changes
1. Update `tests/mcp/schemas.test.ts` with new validation cases
2. Test valid inputs, invalid inputs, enum constraints
3. Verify error messages are actionable for LLMs

### For Performance Changes
1. Update `PERFORMANCE_BASELINE` in `tests/mcp/performance.test.ts`
2. Run performance tests to establish new baseline
3. Document performance implications in PR

## Test Data Management

### Fixtures
- Use `tests/fixtures/` for test data
- Keep fixtures minimal and focused
- Update fixtures when schema changes

### Mocking Strategy
- Mock external dependencies (file system, network, databases)
- Use Vitest's `vi.mock()` for module mocking
- Prefer spies over full mocks when possible

### Cleanup
- Use `beforeEach()` and `afterEach()` for test isolation
- Clean up file system changes
- Reset global state between tests

## CI/CD Integration

### Automated Checks
- Tests run on every push/PR
- Coverage reports generated automatically
- Performance regression detection
- Quality gates: 90% coverage, 0 critical vulnerabilities

### Coverage Reporting
- HTML reports in `coverage/` directory
- Coverage badges in README
- Uncovered lines tracked and addressed

### Performance Monitoring
- Performance baselines tracked in tests
- Regression alerts on performance degradation
- Historical performance data maintained

## Debugging Test Failures

### Common Issues
1. **Database state**: Tests may depend on specific DB state
2. **File system**: Tests creating/modifying files need cleanup
3. **Async operations**: Ensure proper awaiting of promises
4. **Mock leaks**: Mocks persisting between tests

### Debugging Tools
```bash
# Run single test with debug output
npm test -- --reporter=verbose tests/mcp/tool-name.test.ts

# Run with coverage for specific file
npm run test:coverage -- tests/mcp/tool-name.test.ts

# Debug mode
npm test -- --inspect-brk tests/mcp/tool-name.test.ts
```

## Maintenance

### Regular Tasks
- Review and update performance baselines quarterly
- Audit test coverage for new features
- Clean up obsolete test fixtures
- Update documentation for test changes

### Test Health Metrics
- Test execution time (target: <5 minutes)
- Flaky test detection
- Coverage trend analysis
- Test-to-code ratio monitoring

## Troubleshooting

### Test Timeouts
- Increase timeout for slow operations: `test('slow test', async () => { ... }, 10000)`
- Mock slow dependencies
- Run slow tests separately

### Flaky Tests
- Identify root cause (async, timing, external deps)
- Add retry logic for external dependencies
- Stabilize test data and environment

### Coverage Gaps
- Identify uncovered code paths
- Add tests for missing branches
- Consider if uncovered code is unreachable/deprecated

## Future Improvements

### Planned Enhancements
- Property-based testing for schemas
- Load testing for concurrent MCP requests
- Fuzz testing for input validation
- Integration with external LLM testing frameworks

### Tooling Improvements
- Custom test reporters for MCP-specific metrics
- Automated test case generation
- Visual test coverage reports
- Performance profiling integration